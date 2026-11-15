import json
from datetime import datetime, timezone

import requests
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from PIL import Image

from ..models import Company, JobApplication, ResumeProfile
from ..serializers import serialize_job_application
from ..services import ai_client
from ..services.analysis import (
    JOB_ANALYSIS_PROMPT,
    build_company_research_context,
    enrich_analysis_work_schedule,
    parse_analysis_json,
)
from ..services.attachments import MAX_FILE_SIZE
from ..services.memory import memory_context


@csrf_exempt
@require_http_methods(["GET", "PUT"])
def resume_profile(request):
    profile = ResumeProfile.objects.order_by("id").first()
    if request.method == "PUT":
        body = json.loads(request.body or "{}")
        name = str(body.get("name") or "Default resume").strip()[:200]
        resume_text = str(body.get("resume_text") or "").strip()
        if profile is None:
            profile = ResumeProfile.objects.create(name=name, resume_text=resume_text)
        else:
            profile.name = name
            profile.resume_text = resume_text
            profile.save(update_fields=["name", "resume_text", "updated_at"])
    if profile is None:
        return JsonResponse({"name": "Default resume", "resume_text": "", "updated_at": None})
    return JsonResponse(
        {
            "name": profile.name,
            "resume_text": profile.resume_text,
            "updated_at": profile.updated_at.isoformat(),
        }
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def job_applications(request):
    if request.method == "GET":
        applications = JobApplication.objects.order_by("position", "-created_at")
        return JsonResponse(
            {"applications": [serialize_job_application(item, request) for item in applications]}
        )

    company_name = (request.POST.get("company_name") or "").strip()
    job_title = (request.POST.get("job_title") or "").strip()
    company_image = request.FILES.get("company_image")
    if not company_name:
        return JsonResponse({"error": "Company name is required."}, status=400)
    if not job_title:
        return JsonResponse({"error": "Job title is required."}, status=400)
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
    status = (request.POST.get("status") or JobApplication.Status.WATCHLIST).strip()
    if status not in {value for value, _ in JobApplication.Status.choices}:
        return JsonResponse({"error": "A valid job status is required."}, status=400)
    application = JobApplication.objects.create(
        company_name=company_name[:200],
        job_title=job_title[:300],
        company_image=company_image,
        company_description=(request.POST.get("company_description") or "").strip(),
        job_post_link=(request.POST.get("job_post_link") or "").strip(),
        job_description=(request.POST.get("job_description") or "").strip(),
        status=status,
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
@require_http_methods(["POST"])
def reorder_job_applications(request):
    try:
        body = json.loads(request.body or "{}")
    except ValueError:
        return JsonResponse({"error": "Invalid request body."}, status=400)
    status = str(body.get("status") or "").strip()
    if status not in {value for value, _ in JobApplication.Status.choices}:
        return JsonResponse({"error": "A valid job status is required."}, status=400)
    ids = body.get("ids")
    if not isinstance(ids, list) or len(set(map(str, ids))) != len(ids):
        return JsonResponse({"error": "A list of unique job IDs is required."}, status=400)
    try:
        applications = JobApplication.objects.filter(id__in=ids)
        found = {str(item.id) for item in applications}
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid job ID."}, status=400)
    if found != {str(item) for item in ids}:
        return JsonResponse({"error": "One or more job applications were not found."}, status=404)
    with transaction.atomic():
        for index, application_id in enumerate(ids):
            JobApplication.objects.filter(id=application_id).update(status=status, position=index)
    updated = JobApplication.objects.filter(id__in=ids).order_by("position")
    return JsonResponse(
        {"applications": [serialize_job_application(item, request) for item in updated]}
    )


@csrf_exempt
@require_http_methods(["POST", "PATCH", "DELETE"])
def job_application_detail(request, application_id):
    try:
        application = JobApplication.objects.get(id=application_id)
    except (JobApplication.DoesNotExist, ValueError):
        return JsonResponse({"error": "Job application was not found."}, status=404)
    if request.method == "DELETE":
        application.delete()
        return JsonResponse({"ok": True})

    if request.method == "PATCH":
        body = json.loads(request.body or "{}")
        status = str(body.get("status") or "").strip()
        valid_statuses = {value for value, _ in JobApplication.Status.choices}
        if status not in valid_statuses:
            return JsonResponse({"error": "A valid job status is required."}, status=400)
        application.status = status
        application.save(update_fields=["status", "updated_at"])
        return JsonResponse(serialize_job_application(application, request))

    company_name = (request.POST.get("company_name") or "").strip()
    job_title = (request.POST.get("job_title") or "").strip()
    company_image = request.FILES.get("company_image")
    if not company_name:
        return JsonResponse({"error": "Company name is required."}, status=400)
    if not job_title:
        return JsonResponse({"error": "Job title is required."}, status=400)
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
    application.job_title = job_title[:300]
    application.company_description = (request.POST.get("company_description") or "").strip()
    application.job_post_link = (request.POST.get("job_post_link") or "").strip()
    application.job_description = (request.POST.get("job_description") or "").strip()
    status = (request.POST.get("status") or application.status).strip()
    if status not in {value for value, _ in JobApplication.Status.choices}:
        return JsonResponse({"error": "A valid job status is required."}, status=400)
    application.status = status
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
@require_http_methods(["POST"])
def job_application_analysis(request, application_id):
    try:
        application = JobApplication.objects.get(id=application_id)
    except (JobApplication.DoesNotExist, ValueError):
        return JsonResponse({"error": "Job application was not found."}, status=404)

    profile = ResumeProfile.objects.order_by("id").first()
    resume_text = application.tailored_resume_text.strip() or (
        profile.resume_text.strip() if profile else ""
    )
    personal_memory = memory_context().strip()
    job_description = application.job_description.strip()
    if not job_description:
        return JsonResponse(
            {"error": "UNREADABLE_INPUT", "details": "The saved job description is empty."},
            status=400,
        )
    try:
        company_research_context = build_company_research_context(application)
    except OSError as exc:
        return JsonResponse(
            {"error": f"Company research prompt could not be loaded: {exc}"}, status=500
        )
    job_text = f"Job title: {application.job_title}\nCompany: {application.company_name}\nCompany description: {application.company_description}\nJob post: {application.job_post_link}\nJob description:\n{job_description}"
    if resume_text:
        candidate_input = f"RESUME_TEXT:\n{resume_text}\n\nJOB_DESCRIPTION_TEXT:\n{job_text}\n\nSUPPLEMENTAL_MEMORY (recommendations only; never evidence):\n{personal_memory or 'None'}"
        audit_resume_text = resume_text
    else:
        candidate_input = (
            f"CANDIDATE_BACKGROUND (no resume document was provided; these facts come from the candidate's Personal Memory):\n{personal_memory}\n\n"
            f"JOB_DESCRIPTION_TEXT:\n{job_text}\n\n"
            "SPECIAL_RULES: There is no RESUME_TEXT in this analysis, so the rule about SUPPLEMENTAL_MEMORY does not apply: "
            "use CANDIDATE_BACKGROUND as the evidence source for matching, skills, experience, and the resume audit. "
            "Where a detail cannot be verified from the background text (word count, contact details, formatting-related audits), report that honestly instead of guessing. "
            "If CANDIDATE_BACKGROUND is empty, produce a conservative job-only baseline: mark unsupported candidate requirements MISSING, "
            "use empty evidence, assign zero candidate scores where appropriate, and do not return UNREADABLE_INPUT."
        )
        audit_resume_text = None
    prompt = [
        {"role": "system", "content": f"{JOB_ANALYSIS_PROMPT}\n\n{company_research_context}"},
        {"role": "user", "content": candidate_input},
    ]
    try:
        body = json.loads(request.body or "{}")
        model = body.get("model") or "sub-gpt-5.6-luna"
        user_timezone = str(body.get("timezone") or "UTC")
        prompt[1]["content"] += f"\n\nUSER_TIMEZONE (for display conversion only):\n{user_timezone}"
        response = ai_client.ai_analysis_completion(request, {"model": model, "messages": prompt})
        response.raise_for_status()
        analysis = parse_analysis_json(
            response.json()["choices"][0]["message"]["content"], resume_text=audit_resume_text
        )
        analysis = enrich_analysis_work_schedule(analysis, user_timezone)
        application.ai_analysis = json.dumps(analysis, ensure_ascii=False)
        application.ai_analyzed_at = datetime.now(timezone.utc)
        application.save(update_fields=["ai_analysis", "ai_analyzed_at", "updated_at"])
        return JsonResponse(serialize_job_application(application, request))
    except ValueError as exc:
        return JsonResponse({"error": f"AI returned an invalid analysis: {exc}"}, status=422)
    except requests.Timeout:
        return JsonResponse(
            {
                "error": "AI analysis timed out after three attempts. The provider did not finish the response within 5 minutes per attempt. Try again or choose a faster model."
            },
            status=504,
        )
    except requests.exceptions.SSLError:
        return JsonResponse(
            {
                "error": "The AI provider closed the secure connection unexpectedly after three attempts. Wait briefly and try again; if it continues, check the provider status or choose another model."
            },
            status=502,
        )
    except (requests.RequestException, KeyError, TypeError, json.JSONDecodeError) as exc:
        return JsonResponse({"error": f"AI analysis failed: {exc}"}, status=502)
