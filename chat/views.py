import json
import base64
import mimetypes
import re
import requests
from datetime import datetime, timezone
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from io import BytesIO
from pypdf import PdfReader
import fitz
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Conversation, Message, Folder, StoredFile, MemoryNode, BrowserContext

MAX_FILES = 10
MAX_FILE_SIZE = 10 * 1024 * 1024
TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".c", ".cpp", ".h", ".sql", ".yml", ".yaml", ".log"}
URL_PATTERN = re.compile(r"https?://[^\s<>()\[\]{}\"']+", re.IGNORECASE)
MAX_URLS = 5
MAX_URL_BYTES = 2 * 1024 * 1024

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
                extracted = soup.get_text(" ", strip=True)
            else:
                title = ""
                extracted = raw.decode("utf-8", errors="replace")
            extracted = re.sub(r"\s+", " ", extracted).strip()[:30000]
            parts.append(f"URL: {url}\nTitle: {title}\nContent:\n{extracted or '[No readable text found]'}")
        except requests.RequestException as exc:
            parts.append(f"URL: {url}\nThe page could not be fetched: {exc}")
    if len(urls) > MAX_URLS:
        parts.append(f"Only the first {MAX_URLS} URLs were fetched.")
    return "\n\n---\n\n".join(parts)

def serialize_file(f):
    return {"id": str(f.id), "name": f.name, "mime_type": f.mime_type, "size": f.size, "folder_id": str(f.folder_id) if f.folder_id else None, "created_at": f.created_at.isoformat()}

def serialize_folder(f):
    return {"id": str(f.id), "name": f.name, "parent_id": str(f.parent_id) if f.parent_id else None}

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
    return JsonResponse({"folders": [serialize_folder(f) for f in folders], "files": [serialize_file(f) for f in files]})

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
        return JsonResponse(serialize_file(stored), status=201)
    if request.method == "PATCH":
        folder.name = json.loads(request.body or "{}").get("name", folder.name).strip(); folder.save(update_fields=["name"]); return JsonResponse(serialize_folder(folder))
    folder.delete(); return JsonResponse({"ok": True})

@csrf_exempt
@require_http_methods(["DELETE"])
def file_detail(request, file_id):
    f = StoredFile.objects.get(id=file_id); f.file.delete(save=False); f.delete(); return JsonResponse({"ok": True})

@csrf_exempt
@require_http_methods(["GET"])
def drive_search(request):
    query = (request.GET.get("q") or "").strip()
    return JsonResponse({"files": [serialize_file(f) for f in StoredFile.objects.filter(name__icontains=query).order_by("name")[:20]]})

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
@require_http_methods(["POST"])
def memory_arrange(request):
    leaves = list(MemoryNode.objects.filter(is_leaf=True).exclude(content="").order_by("name"))
    if len(leaves) < 2:
        return JsonResponse({"error": "Add at least two memories before arranging."}, status=400)
    original = "\n".join(f"- {node.name}: {node.content}" for node in leaves)
    prompt = [{"role": "system", "content": "Organize the user's memories without losing facts. Return ONLY JSON: {\"groups\":[{\"name\":\"category\",\"items\":[{\"name\":\"short title\",\"content\":\"complete fact\"}]}]}. Preserve every distinct fact; merge only duplicates. Do not invent facts."}, {"role": "user", "content": original}]
    try:
        response = requests.post(f"{settings.MIRZA_BASE_URL.rstrip('/')}/chat/completions", headers={"Authorization": f"Bearer {settings.MIRZA_API_KEY}", "Content-Type": "application/json"}, json={"model": "sub-gpt-5.6-luna", "messages": prompt}, timeout=120)
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
    return {"id": str(c.id), "title": c.title, "model": c.model, "updated_at": c.updated_at.isoformat(), "messages": [{"id": m.id, "role": m.role, "content": m.content} for m in c.messages.order_by("created_at")]}

@csrf_exempt
@require_http_methods(["GET", "POST"])
def conversations(request):
    if request.method == "POST":
        body = json.loads(request.body or "{}")
        c = Conversation.objects.create(model=body.get("model", "sub-gpt-5.6-luna"))
        return JsonResponse(serialize_conversation(c), status=201)
    return JsonResponse({"conversations": [serialize_conversation(c) for c in Conversation.objects.order_by("-updated_at")[:50]]})

@csrf_exempt
@require_http_methods(["GET", "DELETE"])
def conversation_detail(request, conversation_id):
    c = Conversation.objects.get(id=conversation_id)
    if request.method == "DELETE":
        c.delete()
        return JsonResponse({"ok": True})
    return JsonResponse(serialize_conversation(c))

@csrf_exempt
@require_http_methods(["POST"])
def chat(request):
    if not settings.MIRZA_API_KEY or settings.MIRZA_API_KEY == "replace-with-your-key":
        return JsonResponse({"error": "MIRZA_API_KEY is not configured. Set a valid key in .env and restart Django."}, status=500)
    try:
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
        if attachment_parts:
            messages[-1]["content"] = [{"type": "text", "text": text}] + attachment_parts
            messages.append({"role": "system", "content": "When the user asks you to create a file, return it in this exact format: ```file: filename.ext\\nfile contents\\n``` . You may include multiple file blocks. Keep normal explanation outside file blocks."})
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
        if current_memory:
            messages.insert(0, {"role": "system", "content": "Known user memory. Use it only when relevant:\n" + current_memory})
        messages.insert(0, {"role": "system", "content": "If the user explicitly asks you to remember something, return it in this exact format so it can be saved: ```memory: Short title\\nThe durable fact or goal to remember.\\n``` . Keep your normal response outside the memory block."})
        r = requests.post(f"{settings.MIRZA_BASE_URL.rstrip('/')}/chat/completions", headers={"Authorization": f"Bearer {settings.MIRZA_API_KEY}", "Content-Type": "application/json"}, json={"model": model, "messages": messages}, timeout=120)
        if r.status_code == 401:
            return JsonResponse({"error": "Mirza rejected the API key (401). Check MIRZA_API_KEY in .env and restart Django."}, status=502)
        r.raise_for_status(); answer = r.json()["choices"][0]["message"]["content"]
        Message.objects.create(conversation=c, role="assistant", content=answer); c.save(update_fields=["updated_at"])
        return JsonResponse({"conversation_id": str(c.id), "message": {"role": "assistant", "content": answer}, "files": generated_files(answer), "memory": save_memory_blocks(answer)})
    except requests.RequestException as exc: return JsonResponse({"error": f"Mirza request failed: {exc}"}, status=502)
    except (Conversation.DoesNotExist, KeyError, ValueError, json.JSONDecodeError) as exc: return JsonResponse({"error": f"Invalid request: {exc}"}, status=400)
