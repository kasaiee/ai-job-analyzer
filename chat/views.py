import json
import base64
import mimetypes
import re
import requests
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
from io import BytesIO
from pypdf import PdfReader
from PIL import Image
import fitz
from django.conf import settings
from django.db.models import Q
from django.http import FileResponse, JsonResponse, StreamingHttpResponse
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Conversation, Message, Folder, StoredFile, MemoryNode, BrowserContext, Company, CompanyFact, CompanyEmployee, JobApplication

MAX_FILES = 10
MAX_FILE_SIZE = 10 * 1024 * 1024
TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".c", ".cpp", ".h", ".sql", ".yml", ".yaml", ".log"}
URL_PATTERN = re.compile(r"https?://[^\s<>()\[\]{}\"']+", re.IGNORECASE)
MAX_URLS = 5
MAX_URL_BYTES = 2 * 1024 * 1024

def ai_configuration(request):
    api_token = request.headers.get("X-AI-API-Token", "").strip()
    api_url = request.headers.get("X-AI-API-URL", "").strip().rstrip("/")
    if not api_token or not api_url:
        raise ValueError("Configure the AI API token and URL in Settings before using AI features.")
    parsed_url = urlparse(api_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("The AI API URL in Settings is invalid.")
    return api_url, api_token

def ai_completion(request, payload, **options):
    api_url, api_token = ai_configuration(request)
    return requests.post(
        f"{api_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"},
        json=payload,
        **options,
    )

@csrf_exempt
@require_http_methods(["POST"])
def browser_context(request):
    """Receive content captured by the browser extension from the active tab."""
    try:
        body = json.loads(request.body or "{}")
        url = (body.get("url") or "").strip()
        title = (body.get("title") or "Untitled page").strip()[:300]
        text = (body.get("text") or "").strip()[:100000]
        selection = (body.get("selection") or "").strip()[:30000]
        screenshot = body.get("screenshot") or ""
        if len(screenshot) > 8 * 1024 * 1024:
            screenshot = ""
        if not url or not text and not screenshot:
            return JsonResponse({"error": "A page URL and captured page content are required."}, status=400)
        captured = BrowserContext.objects.create(url=url, title=title, text=text, selection=selection, screenshot=screenshot)
        return JsonResponse({"context_id": str(captured.id)})
    except (json.JSONDecodeError, ValueError) as exc:
        return JsonResponse({"error": f"Invalid browser context: {exc}"}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def browser_context_detail(request, context_id):
    try:
        captured = BrowserContext.objects.get(id=context_id)
    except (BrowserContext.DoesNotExist, ValueError):
        return JsonResponse({"error": "Browser context was not found or has expired."}, status=404)
    return JsonResponse({"context": {"url": captured.url, "title": captured.title, "text": captured.text, "selection": captured.selection, "screenshot": captured.screenshot}})

def url_context(text):
    """Fetch readable text from public URLs mentioned in a prompt."""
    urls = []
    for candidate in URL_PATTERN.findall(text or ""):
        candidate = candidate.rstrip(".,!?;:")
        parsed = urlparse(candidate)
        if parsed.scheme in {"http", "https"} and parsed.netloc and candidate not in urls:
            urls.append(candidate)
    parts = []
    for url in urls[:MAX_URLS]:
        try:
            response = requests.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; MirzaChat/1.0)"},
                timeout=15,
                stream=True,
                allow_redirects=True,
            )
            response.raise_for_status()
            content_type = response.headers.get("content-type", "").lower()
            if "text" not in content_type and "json" not in content_type and "xml" not in content_type:
                parts.append(f"URL: {url}\nThis URL returned a non-text resource ({content_type}); no text was extracted.")
                continue
            chunks = []
            total = 0
            for chunk in response.iter_content(chunk_size=65536):
                total += len(chunk)
                if total > MAX_URL_BYTES:
                    break
                chunks.append(chunk)
            raw = b"".join(chunks)
            if "html" in content_type or "xhtml" in content_type:
                soup = BeautifulSoup(raw, "html.parser")
                for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
                    tag.decompose()
                title = soup.title.get_text(" ", strip=True) if soup.title else ""
                logo = soup.find("img", alt=re.compile(r"company logo", re.IGNORECASE))
                logo_url = urljoin(url, logo.get("src", "")) if logo and logo.get("src") else ""
                extracted = soup.get_text(" ", strip=True)
            else:
                title = ""
                logo_url = ""
                extracted = raw.decode("utf-8", errors="replace")
            extracted = re.sub(r"\s+", " ", extracted).strip()[:30000]
            parts.append(f"URL: {url}\nTitle: {title}\nCompany logo: {logo_url}\nContent:\n{extracted or '[No readable text found]'}")
        except requests.RequestException as exc:
            parts.append(f"URL: {url}\nThe page could not be fetched: {exc}")
    if len(urls) > MAX_URLS:
        parts.append(f"Only the first {MAX_URLS} URLs were fetched.")
    return "\n\n---\n\n".join(parts)

def company_name_from_job_url(url, page_text=""):
    """Infer the employer from common job-board URL/title patterns."""
    path = urlparse(url).path.lower()
    match = re.search(r"(?:^|[-_/])at-([a-z0-9][a-z0-9-]*)(?:[-_/]|$)", path)
    if match:
        name = re.sub(r"\s+", " ", match.group(1).replace("-", " ")).strip()
        name = re.sub(r"\s+(?:remote|hybrid|onsite|full time|part time|canada|usa|uk|ireland|israel)$", "", name, flags=re.IGNORECASE)
        return name.title()
    title_match = re.search(r"\bat\s+([A-Z][A-Za-z0-9&.' -]{1,80})", page_text or "")
    if title_match:
        return title_match.group(1).strip(" -|,.")
    return ""

def save_url_company_profiles(message, fetched_context):
    """Create/update companies for job URLs even when the model emits no company block."""
    saved = []
    for url in URL_PATTERN.findall(message or "")[:MAX_URLS]:
        url = url.rstrip(".,!?;:")
        blocks = re.findall(rf"URL: {re.escape(url)}\n([\s\S]*?)(?=\n\n---\n\n|$)", fetched_context or "")
        page_data = blocks[0].strip() if blocks else ""
        name = company_name_from_job_url(url, page_data)
        if not name:
            continue
        company = Company.objects.filter(name__iexact=name).first() or Company.objects.create(name=name)
        if not company.website and urlparse(url).netloc not in {"www.codingjobboard.com", "codingjobboard.com"}:
            company.website = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
        logo_match = re.search(r"^Company logo:\s*(\S+)", page_data, re.MULTILINE)
        if logo_match and logo_match.group(1):
            company.brand_image_url = logo_match.group(1)
        if page_data:
            title = re.search(r"^Title: (.+)$", page_data, re.MULTILINE)
            if title and not company.summary:
                company.summary = title.group(1).strip()[:2000]
            fact_text = page_data[:30000]
        else:
            fact_text = f"Job page URL: {url}"
        company.save()
        if not CompanyFact.objects.filter(company=company, source=url, fact=fact_text).exists():
            CompanyFact.objects.create(company=company, category="job posting", fact=fact_text, source=url, confidence="medium")
        saved.append(serialize_company(company))
    return saved

def serialize_file(f, request=None):
    url = f.file.url
    download_url = f"/api/drive/files/{f.id}/"
    if request:
        url = request.build_absolute_uri(url)
        download_url = request.build_absolute_uri(download_url)
    return {"id": str(f.id), "name": f.name, "mime_type": f.mime_type, "size": f.size, "url": url, "download_url": download_url, "extracted_text": f.extracted_text, "folder_id": str(f.folder_id) if f.folder_id else None, "created_at": f.created_at.isoformat()}

def serialize_folder(f):
    return {"id": str(f.id), "name": f.name, "parent_id": str(f.parent_id) if f.parent_id else None, "created_at": f.created_at.isoformat()}

def stored_file_parts(f):
    with f.file.open("rb") as stream:
        upload = type("Upload", (), {"name": f.name, "size": f.size, "content_type": f.mime_type, "read": stream.read})()
        return attachment_content([upload])

@csrf_exempt
@require_http_methods(["GET"])
def drive(request):
    parent = request.GET.get("parent")
    folders = Folder.objects.filter(parent_id=parent if parent else None).order_by("name")
    files = StoredFile.objects.filter(folder_id=parent if parent else None).order_by("name")
    breadcrumbs = []
    current = Folder.objects.filter(id=parent).first() if parent else None
    while current:
        breadcrumbs.append(serialize_folder(current))
        current = current.parent
    breadcrumbs.reverse()
    return JsonResponse({"folders": [serialize_folder(f) for f in folders], "files": [serialize_file(f, request) for f in files], "breadcrumbs": breadcrumbs})

@csrf_exempt
@require_http_methods(["POST"])
def folder_create(request):
    body = json.loads(request.body or "{}")
    name = (body.get("name") or "").strip()
    if not name: return JsonResponse({"error": "Folder name is required."}, status=400)
    parent = Folder.objects.get(id=body["parent_id"]) if body.get("parent_id") else None
    return JsonResponse(serialize_folder(Folder.objects.create(name=name, parent=parent)), status=201)

@csrf_exempt
@require_http_methods(["POST", "PATCH", "DELETE"])
def folder_detail(request, folder_id):
    folder = Folder.objects.get(id=folder_id)
    if request.method == "POST":
        incoming = request.FILES.get("file")
        if not incoming: return JsonResponse({"error": "File is required."}, status=400)
        if incoming.size > MAX_FILE_SIZE: return JsonResponse({"error": "Files must be 10 MB or smaller."}, status=400)
        stored = StoredFile.objects.create(name=incoming.name, file=incoming, mime_type=incoming.content_type or mimetypes.guess_type(incoming.name)[0] or "application/octet-stream", size=incoming.size, folder=folder)
        return JsonResponse(serialize_file(stored, request), status=201)
    if request.method == "PATCH":
        folder.name = json.loads(request.body or "{}").get("name", folder.name).strip(); folder.save(update_fields=["name"]); return JsonResponse(serialize_folder(folder))
    folder.delete(); return JsonResponse({"ok": True})

@csrf_exempt
@require_http_methods(["GET", "DELETE"])
def file_detail(request, file_id):
    stored_file = StoredFile.objects.get(id=file_id)
    if request.method == "GET":
        return FileResponse(
            stored_file.file.open("rb"),
            as_attachment=True,
            filename=stored_file.name,
            content_type=stored_file.mime_type or "application/octet-stream",
        )
    stored_file.file.delete(save=False)
    stored_file.delete()
    return JsonResponse({"ok": True})

@csrf_exempt
@require_http_methods(["GET"])
def drive_search(request):
    query = (request.GET.get("q") or "").strip()
    files = StoredFile.objects.filter(name__icontains=query)
    if request.GET.get("scope") == "directory":
        parent_id = request.GET.get("parent") or None
        folder_ids = []
        pending_ids = [parent_id] if parent_id else list(Folder.objects.filter(parent=None).values_list("id", flat=True))
        while pending_ids:
            folder_ids.extend(pending_ids)
            pending_ids = list(Folder.objects.filter(parent_id__in=pending_ids).values_list("id", flat=True))
        if parent_id:
            files = files.filter(folder_id__in=folder_ids)
        else:
            files = files.filter(Q(folder=None) | Q(folder_id__in=folder_ids))
    return JsonResponse({"files": [serialize_file(f, request) for f in files.order_by("name")[:100]]})

def serialize_memory(node):
    return {"id": str(node.id), "name": node.name, "content": node.content, "is_leaf": node.is_leaf, "parent_id": str(node.parent_id) if node.parent_id else None, "updated_at": node.updated_at.isoformat(), "children": [serialize_memory(child) for child in node.children.order_by("name")]}

@csrf_exempt
@require_http_methods(["GET", "POST"])
def memory(request):
    if request.method == "GET":
        return JsonResponse({"nodes": [serialize_memory(node) for node in MemoryNode.objects.filter(parent=None).order_by("name")]})
    body = json.loads(request.body or "{}")
    name = (body.get("name") or "").strip(); content = body.get("content", "").strip(); is_leaf = bool(body.get("is_leaf", True))
    if not name: return JsonResponse({"error": "Memory name is required."}, status=400)
    parent = MemoryNode.objects.get(id=body["parent_id"]) if body.get("parent_id") else None
    node = MemoryNode.objects.create(name=name, content=content, is_leaf=is_leaf, parent=parent)
    return JsonResponse(serialize_memory(node), status=201)

@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def memory_detail(request, node_id):
    node = MemoryNode.objects.get(id=node_id)
    if request.method == "DELETE": node.delete(); return JsonResponse({"ok": True})
    body = json.loads(request.body or "{}"); node.name = body.get("name", node.name).strip(); node.content = body.get("content", node.content); node.is_leaf = body.get("is_leaf", node.is_leaf); node.save(); return JsonResponse(serialize_memory(node))

@csrf_exempt
@require_http_methods(["POST", "DELETE"])
def memory_arrange(request):
    if request.method == "DELETE":
        MemoryNode.objects.all().delete()
        return JsonResponse({"ok": True})
    leaves = list(MemoryNode.objects.filter(is_leaf=True).exclude(content="").order_by("name"))
    if len(leaves) < 2:
        return JsonResponse({"error": "Add at least two memories before arranging."}, status=400)
    original = "\n".join(f"- {node.name}: {node.content}" for node in leaves)
    prompt = [{"role": "system", "content": "Organize the user's memories without losing facts. Return ONLY JSON: {\"groups\":[{\"name\":\"category\",\"items\":[{\"name\":\"short title\",\"content\":\"complete fact\"}]}]}. Preserve every distinct fact; merge only duplicates. Do not invent facts."}, {"role": "user", "content": original}]
    try:
        response = ai_completion(request, {"model": "sub-gpt-5.6-luna", "messages": prompt}, timeout=120)
        response.raise_for_status(); data = response.json()["choices"][0]["message"]["content"]
        match = re.search(r"\{[\s\S]*\}", data); arranged = json.loads(match.group(0) if match else data)
        archive = MemoryNode.objects.create(name=f"Archive before arrangement {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", content=original, is_leaf=True)
        MemoryNode.objects.filter(is_leaf=True).exclude(id=archive.id).delete()
        for group in arranged.get("groups", []):
            parent = MemoryNode.objects.create(name=group.get("name", "Organized memory")[:200], is_leaf=False)
            for item in group.get("items", []):
                MemoryNode.objects.create(name=item.get("name", "Memory")[:200], content=item.get("content", ""), parent=parent, is_leaf=True)
        return JsonResponse({"nodes": [serialize_memory(node) for node in MemoryNode.objects.filter(parent=None).order_by("name")], "archive_id": str(archive.id)})
    except (requests.RequestException, ValueError, json.JSONDecodeError, KeyError) as exc:
        return JsonResponse({"error": f"Memory arrangement failed: {exc}"}, status=502)

def memory_context():
    leaves = MemoryNode.objects.filter(is_leaf=True).exclude(content="")
    return "\n".join(f"- {node.name}: {node.content}" for node in leaves)

def serialize_company(company):
    company_url = company.website or ""
    if not company_url and company.linkedin_url:
        company_url = company.linkedin_url
    domain = urlparse(company_url).netloc.lower().removeprefix("www.") if company_url else ""
    logo_url = company.brand_image_url or (f"https://logo.clearbit.com/{domain}" if domain else "")
    return {"id": str(company.id), "name": company.name, "aliases": company.aliases, "website": company.website, "linkedin_url": company.linkedin_url, "logo_url": logo_url, "has_brand_image": bool(company.brand_image_url), "industry": company.industry, "size": company.size, "location": company.location, "summary": company.summary, "updated_at": company.updated_at.isoformat(), "facts": [{"id": str(f.id), "category": f.category, "fact": f.fact, "source": f.source, "confidence": f.confidence, "observed_at": f.observed_at.isoformat()} for f in company.facts.order_by("-observed_at")], "employees": [{"id": str(e.id), "name": e.name, "title": e.title, "linkedin_url": e.linkedin_url, "notes": e.notes, "source": e.source} for e in company.employees.order_by("name")]}

def serialize_job_application(application, request=None):
    image_url = application.company_image.url if application.company_image else ""
    if not image_url:
        image_url = (
            Company.objects.filter(name__iexact=application.company_name)
            .values_list("brand_image_url", flat=True)
            .first()
            or ""
        )
    if image_url and request and not urlparse(image_url).scheme:
        image_url = request.build_absolute_uri(image_url)
    return {
        "id": str(application.id),
        "company_name": application.company_name,
        "company_image_url": image_url,
        "company_description": application.company_description,
        "job_post_link": application.job_post_link,
        "job_description": application.job_description,
        "created_at": application.created_at.isoformat(),
    }

@csrf_exempt
@require_http_methods(["GET", "POST"])
def job_applications(request):
    if request.method == "GET":
        applications = JobApplication.objects.order_by("-created_at")
        return JsonResponse({"applications": [serialize_job_application(item, request) for item in applications]})

    company_name = (request.POST.get("company_name") or "").strip()
    company_image = request.FILES.get("company_image")
    if not company_name:
        return JsonResponse({"error": "Company name is required."}, status=400)
    if company_image:
        if not (company_image.content_type or "").lower().startswith("image/"):
            return JsonResponse({"error": "Company image must be an image file."}, status=400)
        if company_image.size > MAX_FILE_SIZE:
            return JsonResponse({"error": "Company image must be 10 MB or smaller."}, status=400)
        try:
            image = Image.open(company_image)
            image.verify()
            company_image.seek(0)
        except Exception:
            return JsonResponse({"error": "The uploaded company image is invalid."}, status=400)
    application = JobApplication.objects.create(
        company_name=company_name[:200],
        company_image=company_image,
        company_description=(request.POST.get("company_description") or "").strip(),
        job_post_link=(request.POST.get("job_post_link") or "").strip(),
        job_description=(request.POST.get("job_description") or "").strip(),
    )
    company_id = (request.POST.get("company_id") or "").strip()
    if company_id:
        try:
            company = Company.objects.get(id=company_id)
        except (Company.DoesNotExist, ValueError):
            return JsonResponse({"error": "The selected company was not found."}, status=400)
    else:
        company, _ = Company.objects.get_or_create(name=application.company_name)
    company_description = application.company_description
    if company_description:
        company.summary = company_description
    if application.company_image:
        company.brand_image_url = request.build_absolute_uri(application.company_image.url)
    company.save(update_fields=["summary", "brand_image_url", "updated_at"])
    return JsonResponse(serialize_job_application(application, request), status=201)

@csrf_exempt
@require_http_methods(["POST", "DELETE"])
def job_application_detail(request, application_id):
    try:
        application = JobApplication.objects.get(id=application_id)
    except (JobApplication.DoesNotExist, ValueError):
        return JsonResponse({"error": "Job application was not found."}, status=404)
    if request.method == "DELETE":
        application.delete()
        return JsonResponse({"ok": True})

    company_name = (request.POST.get("company_name") or "").strip()
    company_image = request.FILES.get("company_image")
    if not company_name:
        return JsonResponse({"error": "Company name is required."}, status=400)
    if company_image:
        if not (company_image.content_type or "").lower().startswith("image/"):
            return JsonResponse({"error": "Company image must be an image file."}, status=400)
        if company_image.size > MAX_FILE_SIZE:
            return JsonResponse({"error": "Company image must be 10 MB or smaller."}, status=400)
        try:
            image = Image.open(company_image)
            image.verify()
            company_image.seek(0)
        except Exception:
            return JsonResponse({"error": "The uploaded company image is invalid."}, status=400)

    application.company_name = company_name[:200]
    application.company_description = (request.POST.get("company_description") or "").strip()
    application.job_post_link = (request.POST.get("job_post_link") or "").strip()
    application.job_description = (request.POST.get("job_description") or "").strip()
    if company_image:
        application.company_image = company_image
    application.save()

    company, _ = Company.objects.get_or_create(name=application.company_name)
    if application.company_description:
        company.summary = application.company_description
    if application.company_image:
        company.brand_image_url = request.build_absolute_uri(application.company_image.url)
    company.save(update_fields=["summary", "brand_image_url", "updated_at"])
    return JsonResponse(serialize_job_application(application, request))

@csrf_exempt
@require_http_methods(["GET", "POST", "PATCH", "DELETE"])
def companies(request):
    if request.method == "DELETE":
        Company.objects.all().delete()
        return JsonResponse({"ok": True})
    if request.method == "PATCH":
        body = json.loads(request.body or "{}")
        selected_ids = body.get("company_ids") or []
        if not selected_ids:
            return JsonResponse({"error": "Select at least one company to arrange."}, status=400)
        company_data = [serialize_company(company) for company in Company.objects.filter(id__in=selected_ids)]
        if not company_data:
            return JsonResponse({"error": "Selected companies were not found."}, status=404)
        prompt = [{"role": "system", "content": "You merge job-search company profiles. Identify records that refer to the same real company, including subsidiaries, brand variants, abbreviations, and spelling variations. Do not merge genuinely different companies. Return ONLY JSON in this shape: {\"groups\":[{\"name\":\"canonical name\",\"aliases\":[],\"website\":\"\",\"linkedin_url\":\"\",\"brand_image_url\":\"\",\"industry\":\"\",\"size\":\"\",\"location\":\"\",\"summary\":\"complete merged summary\",\"source_company_ids\":[],\"facts\":[{\"category\":\"\",\"fact\":\"\",\"source\":\"\",\"confidence\":\"\"}],\"employees\":[{\"name\":\"\",\"title\":\"\",\"linkedin_url\":\"\",\"notes\":\"\",\"source\":\"\"}]}]}. Preserve every distinct fact, employee, and source URL. Do not invent data."}, {"role": "user", "content": json.dumps(company_data, ensure_ascii=False)}]
        try:
            response = ai_completion(request, {"model": "sub-gpt-5.6-luna", "messages": prompt}, timeout=120)
            response.raise_for_status()
            raw = response.json()["choices"][0]["message"]["content"]
            match = re.search(r"\{[\s\S]*\}", raw)
            groups = json.loads(match.group(0) if match else raw).get("groups", [])
            if not groups and company_data:
                return JsonResponse({"error": "The AI returned no company groups; existing company memory was preserved."}, status=502)
            Company.objects.filter(id__in=selected_ids).delete()
            for group in groups:
                company = Company.objects.create(name=(group.get("name") or "Unnamed company")[:200], aliases=group.get("aliases", []), website=group.get("website", ""), linkedin_url=group.get("linkedin_url", ""), brand_image_url=group.get("brand_image_url", ""), industry=group.get("industry", ""), size=group.get("size", ""), location=group.get("location", ""), summary=group.get("summary", ""))
                for item in group.get("facts", []):
                    if item.get("fact"): CompanyFact.objects.create(company=company, category=item.get("category", "general")[:100], fact=item["fact"], source=item.get("source", "")[:500], confidence=item.get("confidence", "medium")[:20])
                for item in group.get("employees", []):
                    if item.get("name"): CompanyEmployee.objects.create(company=company, name=item["name"][:200], title=item.get("title", "")[:300], linkedin_url=item.get("linkedin_url", ""), notes=item.get("notes", ""), source=item.get("source", "")[:500])
        except (requests.RequestException, ValueError, json.JSONDecodeError, KeyError) as exc:
            return JsonResponse({"error": f"Company arrangement failed: {exc}"}, status=502)
        return JsonResponse({"companies": [serialize_company(c) for c in Company.objects.order_by("name")]})
    if request.method == "GET":
        query = (request.GET.get("q") or "").strip()
        items = Company.objects.filter(name__icontains=query).order_by("name")[:50] if query else Company.objects.order_by("-updated_at")[:50]
        return JsonResponse({"companies": [serialize_company(c) for c in items]})
    body = request.POST if request.content_type.startswith("multipart/form-data") else json.loads(request.body or "{}")
    name = (body.get("name") or "").strip()
    if not name: return JsonResponse({"error": "Company name is required."}, status=400)
    aliases = body.get("aliases", [])
    if isinstance(aliases, str):
        aliases = [item.strip() for item in aliases.split(",") if item.strip()]
    company = Company.objects.create(name=name, aliases=aliases, website=body.get("website", ""), linkedin_url=body.get("linkedin_url", ""), industry=body.get("industry", ""), size=body.get("size", ""), location=body.get("location", ""), summary=body.get("summary", ""))
    uploaded = request.FILES.get("brand_image")
    if uploaded:
        content_type = (uploaded.content_type or "").lower()
        if not content_type.startswith("image/") or uploaded.size > 10 * 1024 * 1024:
            company.delete()
            return JsonResponse({"error": "Company image must be a valid image of 10 MB or smaller."}, status=400)
        try:
            image = Image.open(uploaded)
            image.verify()
            uploaded.seek(0)
            image = Image.open(uploaded).convert("RGBA")
            output = BytesIO()
            image.save(output, format="PNG", optimize=True)
            saved_path = default_storage.save(f"company-logos/{uuid.uuid4()}.png", ContentFile(output.getvalue()))
            company.brand_image_url = request.build_absolute_uri(f"{settings.MEDIA_URL}{saved_path}")
            company.save(update_fields=["brand_image_url", "updated_at"])
        except Exception:
            company.delete()
            return JsonResponse({"error": "The uploaded company image is invalid."}, status=400)
    return JsonResponse(serialize_company(company), status=201)

@csrf_exempt
@require_http_methods(["GET", "POST", "PATCH", "DELETE"])
def company_detail(request, company_id):
    company = Company.objects.get(id=company_id)
    if request.method == "DELETE": company.delete(); return JsonResponse({"ok": True})
    if request.method == "POST":
        uploaded = request.FILES.get("logo")
        if request.POST.get("name") is not None:
            name = request.POST.get("name", "").strip()
            if not name:
                return JsonResponse({"error": "Company name is required."}, status=400)
            company.name = name[:200]
        if request.POST.get("summary") is not None:
            company.summary = request.POST.get("summary", "").strip()
        if uploaded:
            content_type = (uploaded.content_type or "").lower()
            if not content_type.startswith("image/"):
                return JsonResponse({"error": "Logo must be an image file."}, status=400)
            if uploaded.size > 10 * 1024 * 1024:
                return JsonResponse({"error": "Logo must be 10 MB or smaller."}, status=400)
            try:
                image = Image.open(uploaded)
                image.verify()
                uploaded.seek(0)
                image = Image.open(uploaded).convert("RGBA")
                output = BytesIO()
                image.save(output, format="PNG", optimize=True)
                saved_path = default_storage.save(f"company-logos/{uuid.uuid4()}.png", ContentFile(output.getvalue()))
            except Exception:
                return JsonResponse({"error": "The uploaded file is not a valid image."}, status=400)
            company.brand_image_url = request.build_absolute_uri(f"{settings.MEDIA_URL}{saved_path}")
        company.save()
        return JsonResponse(serialize_company(company))
    if request.method == "PATCH":
        body = json.loads(request.body or "{}")
        for field in ("name", "website", "linkedin_url", "brand_image_url", "industry", "size", "location", "summary", "aliases"):
            if field in body: setattr(company, field, body[field])
        company.save(); return JsonResponse(serialize_company(company))
    return JsonResponse(serialize_company(company))

def save_company_blocks(text):
    pattern = re.compile(r"(?:```)?company\s*:\s*([^\n`{]+?)\s*(\{[\s\S]*?\})(?:```|(?=\n|$))", re.IGNORECASE)
    saved = []
    for match in pattern.finditer(text or ""):
        try: data = json.loads(match.group(2).strip())
        except (ValueError, json.JSONDecodeError): continue
        name = (data.get("name") or match.group(1)).strip()[:200]
        company = Company.objects.filter(name__iexact=name).first() or Company.objects.create(name=name)
        for field in ("aliases", "website", "linkedin_url", "brand_image_url", "industry", "size", "location", "summary"):
            if data.get(field): setattr(company, field, data[field])
        company.save()
        for item in data.get("facts", []):
            fact = (item.get("fact") or "").strip()
            if fact: CompanyFact.objects.create(company=company, category=item.get("category", "general")[:100], fact=fact, source=item.get("source", "User-provided chat")[:500], confidence=item.get("confidence", "medium")[:20])
        for item in data.get("employees", []):
            person = (item.get("name") or "").strip()
            if person: CompanyEmployee.objects.update_or_create(company=company, name=person, defaults={"title": item.get("title", ""), "linkedin_url": item.get("linkedin_url", ""), "notes": item.get("notes", ""), "source": item.get("source", "User-provided chat")[:500]})
        saved.append(serialize_company(company))
    return saved

def save_memory_blocks(text):
    pattern = re.compile(r"```memory\s*:\s*([^\n`]+)\n([\s\S]*?)```", re.IGNORECASE)
    saved = []
    for match in pattern.finditer(text or ""):
        name = match.group(1).strip()[:200]; content = match.group(2).strip()
        if name and content:
            node = MemoryNode.objects.create(name=name, content=content, is_leaf=True)
            saved.append(serialize_memory(node))
    return saved

def attachment_content(uploaded_files):
    """Turn uploaded files into OpenAI-compatible prompt content."""
    if len(uploaded_files) > MAX_FILES:
        raise ValueError(f"You can attach up to {MAX_FILES} files.")
    parts = []
    for uploaded in uploaded_files:
        if uploaded.size > MAX_FILE_SIZE:
            raise ValueError(f"{uploaded.name} is larger than 10 MB.")
        name = uploaded.name.replace("\n", " ")
        mime = uploaded.content_type or mimetypes.guess_type(name)[0] or "application/octet-stream"
        uploaded.seek(0)
        raw = uploaded.read()
        if mime == "application/pdf" or name.lower().endswith(".pdf"):
            # Extract selectable text first. This is fast and preserves resume text.
            try:
                pdf = PdfReader(BytesIO(raw))
                extracted = "\n\n".join((page.extract_text() or "") for page in pdf.pages).strip()
            except Exception:
                extracted = ""
            if extracted:
                parts.append({"type": "text", "text": f"\n--- Extracted PDF text: {name} ---\n{extracted}\n--- End extracted text: {name} ---\n"})
            # Render pages too, so the model can read scanned/image-only text.
            try:
                document = fitz.open(stream=raw, filetype="pdf")
                for page_number, page in enumerate(document[:10], start=1):
                    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.35, 1.35), alpha=False)
                    image_bytes = pixmap.tobytes("jpeg", jpg_quality=72)
                    encoded = base64.b64encode(image_bytes).decode("ascii")
                    parts.append({"type": "text", "text": f"PDF page {page_number} image from {name}; read any text visible in this page."})
                    parts.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded}"}})
                if len(document) > 10:
                    parts.append({"type": "text", "text": f"Only the first 10 pages of {name} were included."})
                document.close()
            except Exception as exc:
                parts.append({"type": "text", "text": f"PDF page preview could not be rendered for {name}: {exc}"})
        elif mime.startswith("image/"):
            encoded = base64.b64encode(raw).decode("ascii")
            parts.append({"type": "text", "text": f"Attached image: {name}"})
            parts.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}})
        elif mime.startswith("text/") or any(name.lower().endswith(ext) for ext in TEXT_EXTENSIONS):
            text = raw.decode("utf-8", errors="replace")
            parts.append({"type": "text", "text": f"\n--- Attached file: {name} ---\n{text}\n--- End {name} ---\n"})
        else:
            parts.append({"type": "text", "text": f"Attached file: {name} ({mime}). Its binary contents were not extracted; ask the user for a text export if needed."})
    return parts

def company_name_from_logo_text(text):
    patterns = [
        r"(?:logo|brand logo)\s+(?:of|for)\s+([A-Z][A-Za-z0-9&.' -]{1,80})",
        r"لوگوی\s+(?:مربوط\s+به|برای)?\s*([A-Za-z][A-Za-z0-9&.'-]{1,80})",
        r"logo\s+(?:of|for)?\s*([A-Z][A-Za-z0-9&.' -]{1,80})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text or "", re.IGNORECASE)
        if match:
            return match.group(1).strip(" .،,؛;:()\n")
    return ""

def generated_files(text):
    """Parse optional assistant file blocks: ```file: report.txt ... ```"""
    pattern = re.compile(r"```file\s*:\s*([^\n`]+)\n([\s\S]*?)```", re.IGNORECASE)
    files = []
    for match in pattern.finditer(text or ""):
        filename = match.group(1).strip().replace("/", "_").replace("\\", "_")
        if filename and len(filename) <= 120:
            files.append({"name": filename, "content": match.group(2), "mime": mimetypes.guess_type(filename)[0] or "text/plain"})
    return files

def serialize_conversation(c):
    return {"id": str(c.id), "title": c.title, "model": c.model, "updated_at": c.updated_at.isoformat(), "messages": [{"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at.isoformat()} for m in c.messages.order_by("created_at")]}

@csrf_exempt
@require_http_methods(["GET", "POST"])
def conversations(request):
    if request.method == "POST":
        body = json.loads(request.body or "{}")
        c = Conversation.objects.create(model=body.get("model", "sub-gpt-5.6-luna"))
        return JsonResponse(serialize_conversation(c), status=201)
    return JsonResponse({"conversations": [serialize_conversation(c) for c in Conversation.objects.order_by("-updated_at")[:50]]})

@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def conversation_detail(request, conversation_id):
    c = Conversation.objects.get(id=conversation_id)
    if request.method == "DELETE":
        c.delete()
        return JsonResponse({"ok": True})
    if request.method == "PATCH":
        body = json.loads(request.body or "{}")
        title = (body.get("title") or "").strip()
        if not title:
            return JsonResponse({"error": "Title is required"}, status=400)
        c.title = title[:200]
        c.save(update_fields=["title", "updated_at"])
        return JsonResponse(serialize_conversation(c))
    return JsonResponse(serialize_conversation(c))

@csrf_exempt
@require_http_methods(["POST"])
def chat(request):
    try:
        ai_url, ai_token = ai_configuration(request)
        body = request.POST if request.content_type.startswith("multipart/form-data") else json.loads(request.body or "{}")
        text = (body.get("message") or "").strip(); model = body.get("model", "sub-gpt-5.6-luna")
        uploaded_files = request.FILES.getlist("files")
        mentioned_ids = body.getlist("file_ids") if hasattr(body, "getlist") else body.get("file_ids", [])
        if isinstance(mentioned_ids, str): mentioned_ids = [mentioned_ids]
        browser_capture = body.get("browser_context") if hasattr(body, "get") else None
        browser_context_id = body.get("browser_context_id") if hasattr(body, "get") else None
        if browser_context_id:
            try:
                captured = BrowserContext.objects.get(id=browser_context_id)
                browser_capture = {"url": captured.url, "title": captured.title, "text": captured.text, "selection": captured.selection, "screenshot": captured.screenshot}
            except (BrowserContext.DoesNotExist, ValueError):
                return JsonResponse({"error": "Browser context was not found or has expired."}, status=400)
        if browser_capture:
            try:
                browser_capture = json.loads(browser_capture)
            except json.JSONDecodeError:
                browser_capture = None
        if not text and not uploaded_files: return JsonResponse({"error": "Message or at least one file is required."}, status=400)
        if not text: text = "Please inspect and summarize the attached files."
        c = Conversation.objects.get(id=body["conversation_id"]) if body.get("conversation_id") else Conversation.objects.create(model=model)
        c.model = model
        if c.messages.count() == 0: c.title = text[:48]
        c.save(update_fields=["model", "title", "updated_at"])
        attachment_parts = attachment_content(uploaded_files)
        for stored in StoredFile.objects.filter(id__in=mentioned_ids):
            attachment_parts.extend(stored_file_parts(stored))
        Message.objects.create(conversation=c, role="user", content=text)
        messages = [{"role": m.role, "content": m.content} for m in c.messages.order_by("created_at")]
        file_instruction = None
        if attachment_parts:
            messages[-1]["content"] = [{"type": "text", "text": text}] + attachment_parts
            file_instruction = "When the user asks you to create a file, return it in this exact format: ```file: filename.ext\\nfile contents\\n``` . You may include multiple file blocks. Keep normal explanation outside file blocks."
        fetched_urls = url_context(text)
        if fetched_urls:
            messages[-1]["content"] = [{"type": "text", "text": text + "\n\nPublic URL context:\n" + fetched_urls}] if isinstance(messages[-1]["content"], str) else [{"type": "text", "text": text + "\n\nPublic URL context:\n" + fetched_urls}] + messages[-1]["content"][1:]
        if browser_capture:
            browser_text = f"Browser-captured page: {browser_capture.get('title', 'Untitled')}\nURL: {browser_capture.get('url', '')}\nVisible text:\n{browser_capture.get('text', '')[:100000]}"
            if browser_capture.get("selection"):
                browser_text += f"\nUser selection:\n{browser_capture['selection'][:30000]}"
            content_parts = [{"type": "text", "text": browser_text}]
            screenshot = browser_capture.get("screenshot", "")
            if screenshot.startswith("data:image/"):
                content_parts.append({"type": "image_url", "image_url": {"url": screenshot}})
            messages[-1]["content"] = content_parts if isinstance(messages[-1]["content"], str) else [{"type": "text", "text": text}, *content_parts, *messages[-1]["content"][1:]]
        current_memory = memory_context()
        known_companies = "\n".join(f"- {company.name}: {company.summary}" for company in Company.objects.exclude(summary="").order_by("-updated_at")[:30])
        company_instruction = '''You are a job-search assistant. Infer the user's intent from their message and the attached URL context. A shared page may be a job posting, company page, employee profile, article, or research source; do not assume the user wants a summary unless they ask for one. Answer the actual request using the page content. When the user provides substantial company information, preserve it in this exact format:
```company: Company Name
{"name":"...","brand_image_url":"...","summary":"...","facts":[{"category":"hiring","fact":"...","source":"...","confidence":"medium"}],"employees":[{"name":"...","title":"...","linkedin_url":"...","notes":"..."}]}
```
Preserve facts, update existing companies, and do not invent information. Known company summaries:
''' + known_companies
        system_instructions = [
            company_instruction,
            "If the user explicitly asks you to remember a personal fact, preference, experience, goal, or job-search constraint, return it in this exact format so it can be saved in Personal Memory: ```memory: Short title\\nThe durable personal fact or goal to remember.\\n``` . Do not put company facts, job-posting facts, employee information, or website research in Personal Memory; those belong in the company profile.",
        ]
        if current_memory:
            system_instructions.append("Known user memory. Use it only when relevant:\n" + current_memory)
        if file_instruction:
            system_instructions.append(file_instruction)
        existing_system_instructions = [
            message["content"] for message in messages if message.get("role") == "system"
        ]
        messages = [
            {"role": "system", "content": "\n\n".join(existing_system_instructions + system_instructions)},
            *[message for message in messages if message.get("role") != "system"],
        ]
        def event(payload):
            return json.dumps(payload, ensure_ascii=False) + "\n"

        def stream_answer():
            answer_parts = []
            try:
                response = requests.post(f"{ai_url}/chat/completions", headers={"Authorization": f"Bearer {ai_token}", "Content-Type": "application/json"}, json={"model": model, "messages": messages, "stream": True}, timeout=120, stream=True)
                if response.status_code == 401:
                    yield event({"type": "error", "error": "The AI provider rejected the API token (401). Check your AI settings."}); return
                response.raise_for_status()
                for line in response.iter_lines(decode_unicode=True):
                    if not line: continue
                    if line.startswith("data:"): line = line[5:].strip()
                    if line == "[DONE]": break
                    try: data = json.loads(line)
                    except json.JSONDecodeError: continue
                    choice = (data.get("choices") or [{}])[0]
                    token = (choice.get("delta") or {}).get("content") or (choice.get("message") or {}).get("content") or ""
                    if token:
                        answer_parts.append(token)
                        yield event({"type": "token", "text": token})
                answer = "".join(answer_parts)
                Message.objects.create(conversation=c, role="assistant", content=answer); c.save(update_fields=["updated_at"])
                company_blocks = save_company_blocks(answer)
                url_companies = save_url_company_profiles(text, fetched_urls)
                company_ids = {company["id"] for company in company_blocks}
                company_blocks.extend(company for company in url_companies if company["id"] not in company_ids)
                yield event({"type": "complete", "conversation_id": str(c.id), "message": {"role": "assistant", "content": answer}, "files": generated_files(answer), "memory": save_memory_blocks(answer), "companies": company_blocks})
            except requests.RequestException as exc:
                yield event({"type": "error", "error": f"Mirza request failed: {exc}"})
            except Exception as exc:
                yield event({"type": "error", "error": f"Response processing failed: {exc}"})
        response = StreamingHttpResponse(stream_answer(), content_type="application/x-ndjson")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
    except requests.RequestException as exc: return JsonResponse({"error": f"Mirza request failed: {exc}"}, status=502)
    except (Conversation.DoesNotExist, KeyError, ValueError, json.JSONDecodeError) as exc: return JsonResponse({"error": f"Invalid request: {exc}"}, status=400)
