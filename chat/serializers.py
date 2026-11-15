"""JSON representations of domain models returned by the API."""

import json
from urllib.parse import urlparse

from .models import Company
from .services.analysis import enrich_analysis_work_schedule
from .services.cover_letters import cover_letter_template_data
from .services.resumes import (
    RESUME_TEMPLATE_ID,
    normalize_resume_template,
    resume_placeholder_count,
)


def serialize_memory(node):
    return {
        "id": str(node.id),
        "name": node.name,
        "content": node.content,
        "is_leaf": node.is_leaf,
        "parent_id": str(node.parent_id) if node.parent_id else None,
        "updated_at": node.updated_at.isoformat(),
        "children": [serialize_memory(child) for child in node.children.order_by("name")],
    }


def memory_path(node):
    parts = []
    current = node.parent
    while current:
        parts.append(current.name)
        current = current.parent
    return list(reversed(parts))


def serialize_memory_item(node, include_path=False):
    result = {
        "id": str(node.id),
        "name": node.name,
        "content": node.content,
        "is_leaf": node.is_leaf,
        "parent_id": str(node.parent_id) if node.parent_id else None,
        "updated_at": node.updated_at.isoformat(),
    }
    if include_path:
        result["path"] = memory_path(node)
    return result


def serialize_company(company):
    company_url = company.website or ""
    if not company_url and company.linkedin_url:
        company_url = company.linkedin_url
    domain = urlparse(company_url).netloc.lower().removeprefix("www.") if company_url else ""
    logo_url = company.brand_image_url or (f"https://logo.clearbit.com/{domain}" if domain else "")
    facts = [
        {
            "id": str(fact.id),
            "category": fact.category,
            "fact": fact.fact,
            "source": fact.source,
            "confidence": fact.confidence,
            "observed_at": fact.observed_at.isoformat(),
        }
        for fact in company.facts.order_by("-observed_at")
    ]
    employees = [
        {
            "id": str(employee.id),
            "name": employee.name,
            "title": employee.title,
            "linkedin_url": employee.linkedin_url,
            "notes": employee.notes,
            "source": employee.source,
        }
        for employee in company.employees.order_by("name")
    ]
    return {
        "id": str(company.id),
        "name": company.name,
        "aliases": company.aliases,
        "website": company.website,
        "linkedin_url": company.linkedin_url,
        "logo_url": logo_url,
        "has_brand_image": bool(company.brand_image_url),
        "industry": company.industry,
        "size": company.size,
        "location": company.location,
        "summary": company.summary,
        "updated_at": company.updated_at.isoformat(),
        "facts": facts,
        "employees": employees,
    }


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
    try:
        ai_analysis = json.loads(application.ai_analysis) if application.ai_analysis else None
    except (TypeError, json.JSONDecodeError):
        ai_analysis = (
            {"legacy_markdown": application.ai_analysis} if application.ai_analysis else None
        )
    if isinstance(ai_analysis, dict) and not ai_analysis.get("legacy_markdown"):
        stored_schedule = ai_analysis.get("work_schedule") or {}
        stored_user_timezone = stored_schedule.get("user_timezone") or "UTC"
        ai_analysis = enrich_analysis_work_schedule(ai_analysis, stored_user_timezone)
    return {
        "id": str(application.id),
        "company_name": application.company_name,
        "job_title": application.job_title,
        "company_image_url": image_url,
        "company_description": application.company_description,
        "job_post_link": application.job_post_link,
        "job_description": application.job_description,
        "status": application.status,
        "position": application.position,
        "tailored_resume_text": application.tailored_resume_text,
        "ai_analysis": ai_analysis,
        "ai_analyzed_at": (
            application.ai_analyzed_at.isoformat() if application.ai_analyzed_at else None
        ),
        "created_at": application.created_at.isoformat(),
    }


def serialize_tailored_resume(resume):
    resume_data = normalize_resume_template(resume.resume_data)
    return {
        "id": str(resume.id),
        "version_number": resume.version_number,
        "name": resume.name,
        "resume_data": resume_data,
        "template_id": RESUME_TEMPLATE_ID,
        "page_size": resume.page_size,
        "model": resume.model,
        "is_current": resume.is_current,
        "placeholder_count": resume_placeholder_count(resume_data),
        "created_at": resume.created_at.isoformat(),
        "updated_at": resume.updated_at.isoformat(),
    }


def serialize_cover_letter(letter):
    return {
        "id": str(letter.id),
        "version_number": letter.version_number,
        "name": letter.name,
        "content": letter.content,
        "template_data": cover_letter_template_data(letter),
        "model": letter.model,
        "is_current": letter.is_current,
        "created_at": letter.created_at.isoformat(),
        "updated_at": letter.updated_at.isoformat(),
    }


def serialize_conversation(c):
    messages = [
        {
            "id": message.id,
            "role": message.role,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }
        for message in c.messages.order_by("created_at")
    ]
    return {
        "id": str(c.id),
        "title": c.title,
        "model": c.model,
        "updated_at": c.updated_at.isoformat(),
        "messages": messages,
    }
