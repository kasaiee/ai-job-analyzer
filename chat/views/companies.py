import json
import re
import uuid
from io import BytesIO

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from PIL import Image

from ..models import Company, CompanyEmployee, CompanyFact
from ..serializers import serialize_company
from ..services import ai_client


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
        company_data = [
            serialize_company(company) for company in Company.objects.filter(id__in=selected_ids)
        ]
        if not company_data:
            return JsonResponse({"error": "Selected companies were not found."}, status=404)
        prompt = [
            {
                "role": "system",
                "content": 'You merge job-search company profiles. Identify records that refer to the same real company, including subsidiaries, brand variants, abbreviations, and spelling variations. Do not merge genuinely different companies. Return ONLY JSON in this shape: {"groups":[{"name":"canonical name","aliases":[],"website":"","linkedin_url":"","brand_image_url":"","industry":"","size":"","location":"","summary":"complete merged summary","source_company_ids":[],"facts":[{"category":"","fact":"","source":"","confidence":""}],"employees":[{"name":"","title":"","linkedin_url":"","notes":"","source":""}]}]}. Preserve every distinct fact, employee, and source URL. Do not invent data.',
            },
            {"role": "user", "content": json.dumps(company_data, ensure_ascii=False)},
        ]
        try:
            response = ai_client.ai_completion(
                request, {"model": "sub-gpt-5.6-luna", "messages": prompt}, timeout=120
            )
            response.raise_for_status()
            raw = response.json()["choices"][0]["message"]["content"]
            match = re.search(r"\{[\s\S]*\}", raw)
            groups = json.loads(match.group(0) if match else raw).get("groups", [])
            if not groups and company_data:
                return JsonResponse(
                    {
                        "error": "The AI returned no company groups; existing company memory was preserved."
                    },
                    status=502,
                )
            Company.objects.filter(id__in=selected_ids).delete()
            for group in groups:
                company = Company.objects.create(
                    name=(group.get("name") or "Unnamed company")[:200],
                    aliases=group.get("aliases", []),
                    website=group.get("website", ""),
                    linkedin_url=group.get("linkedin_url", ""),
                    brand_image_url=group.get("brand_image_url", ""),
                    industry=group.get("industry", ""),
                    size=group.get("size", ""),
                    location=group.get("location", ""),
                    summary=group.get("summary", ""),
                )
                for item in group.get("facts", []):
                    if item.get("fact"):
                        CompanyFact.objects.create(
                            company=company,
                            category=item.get("category", "general")[:100],
                            fact=item["fact"],
                            source=item.get("source", "")[:500],
                            confidence=item.get("confidence", "medium")[:20],
                        )
                for item in group.get("employees", []):
                    if item.get("name"):
                        CompanyEmployee.objects.create(
                            company=company,
                            name=item["name"][:200],
                            title=item.get("title", "")[:300],
                            linkedin_url=item.get("linkedin_url", ""),
                            notes=item.get("notes", ""),
                            source=item.get("source", "")[:500],
                        )
        except (requests.RequestException, ValueError, json.JSONDecodeError, KeyError) as exc:
            return JsonResponse({"error": f"Company arrangement failed: {exc}"}, status=502)
        return JsonResponse(
            {"companies": [serialize_company(c) for c in Company.objects.order_by("name")]}
        )
    if request.method == "GET":
        query = (request.GET.get("q") or "").strip()
        items = (
            Company.objects.filter(name__icontains=query).order_by("name")[:50]
            if query
            else Company.objects.order_by("-updated_at")
        )
        return JsonResponse({"companies": [serialize_company(c) for c in items]})
    body = (
        request.POST
        if request.content_type.startswith("multipart/form-data")
        else json.loads(request.body or "{}")
    )
    name = (body.get("name") or "").strip()
    if not name:
        return JsonResponse({"error": "Company name is required."}, status=400)
    aliases = body.get("aliases", [])
    if isinstance(aliases, str):
        aliases = [item.strip() for item in aliases.split(",") if item.strip()]
    company = Company.objects.create(
        name=name,
        aliases=aliases,
        website=body.get("website", ""),
        linkedin_url=body.get("linkedin_url", ""),
        industry=body.get("industry", ""),
        size=body.get("size", ""),
        location=body.get("location", ""),
        summary=body.get("summary", ""),
    )
    uploaded = request.FILES.get("brand_image")
    if uploaded:
        content_type = (uploaded.content_type or "").lower()
        if not content_type.startswith("image/") or uploaded.size > 10 * 1024 * 1024:
            company.delete()
            return JsonResponse(
                {"error": "Company image must be a valid image of 10 MB or smaller."}, status=400
            )
        try:
            image = Image.open(uploaded)
            image.verify()
            uploaded.seek(0)
            image = Image.open(uploaded).convert("RGBA")
            output = BytesIO()
            image.save(output, format="PNG", optimize=True)
            saved_path = default_storage.save(
                f"company-logos/{uuid.uuid4()}.png", ContentFile(output.getvalue())
            )
            company.brand_image_url = request.build_absolute_uri(
                f"{settings.MEDIA_URL}{saved_path}"
            )
            company.save(update_fields=["brand_image_url", "updated_at"])
        except Exception:
            company.delete()
            return JsonResponse({"error": "The uploaded company image is invalid."}, status=400)
    return JsonResponse(serialize_company(company), status=201)


@csrf_exempt
@require_http_methods(["GET", "POST", "PATCH", "DELETE"])
def company_detail(request, company_id):
    company = Company.objects.get(id=company_id)
    if request.method == "DELETE":
        company.delete()
        return JsonResponse({"ok": True})
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
                saved_path = default_storage.save(
                    f"company-logos/{uuid.uuid4()}.png", ContentFile(output.getvalue())
                )
            except Exception:
                return JsonResponse(
                    {"error": "The uploaded file is not a valid image."}, status=400
                )
            company.brand_image_url = request.build_absolute_uri(
                f"{settings.MEDIA_URL}{saved_path}"
            )
        company.save()
        return JsonResponse(serialize_company(company))
    if request.method == "PATCH":
        body = json.loads(request.body or "{}")
        for field in (
            "name",
            "website",
            "linkedin_url",
            "brand_image_url",
            "industry",
            "size",
            "location",
            "summary",
            "aliases",
        ):
            if field in body:
                setattr(company, field, body[field])
        company.save()
        return JsonResponse(serialize_company(company))
    return JsonResponse(serialize_company(company))
