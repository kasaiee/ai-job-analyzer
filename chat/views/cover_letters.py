import json
import re
from datetime import datetime, timezone
from io import BytesIO

import requests
from django.db import transaction
from django.http import FileResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..models import CoverLetterVersion
from ..selectors import get_job_application
from ..serializers import serialize_cover_letter
from ..services import ai_client
from ..services.cover_letters import (
    COVER_LETTER_PROMPT,
    company_profile_for_application,
    cover_letter_template_data,
    normalize_cover_letter_text,
    parse_cover_letter_template_data,
    pdf_cover_letter_text,
)
from ..services.memory import memory_records_for_resume


@csrf_exempt
@require_http_methods(["GET"])
def cover_letters(request, application_id):
    application = get_job_application(application_id)
    if not application:
        return JsonResponse({"error": "Job application was not found."}, status=404)
    return JsonResponse(
        {
            "cover_letters": [
                serialize_cover_letter(x)
                for x in application.cover_letter_versions.order_by("-version_number")
            ]
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def generate_cover_letter(request, application_id):
    application = get_job_application(application_id)
    if not application:
        return JsonResponse({"error": "Job application was not found."}, status=404)
    if not application.job_description.strip():
        return JsonResponse(
            {"error": "Add a job description before generating a cover letter."}, status=400
        )
    memories = memory_records_for_resume()
    if not memories:
        return JsonResponse(
            {"error": "Add Personal Memory facts before generating a cover letter."}, status=400
        )
    try:
        body = json.loads(request.body or "{}")
        model = body.get("model") or "sub-gpt-5.6-luna"
        instructions = str(body.get("instructions") or "")[:20000]
        context = f"CURRENT_DATE:\n{datetime.now(timezone.utc).strftime('%B %d, %Y')}\n\nPERSONAL_MEMORY:\n{json.dumps(memories, ensure_ascii=False)}\n\nJOB:\nTitle: {application.job_title}\nCompany: {application.company_name}\n{application.job_description}\n\nCOMPANY_PROFILE:\n{json.dumps(company_profile_for_application(application), ensure_ascii=False)}\n\nUSER_INSTRUCTIONS:\n{instructions or 'None'}"
        response = ai_client.ai_analysis_completion(
            request,
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": COVER_LETTER_PROMPT},
                    {"role": "user", "content": context},
                ],
            },
        )
        response.raise_for_status()
        content = normalize_cover_letter_text(
            re.sub(
                r"^```(?:text|markdown)?\s*|\s*```$",
                "",
                response.json()["choices"][0]["message"]["content"].strip(),
                flags=re.IGNORECASE,
            )
        )
        with transaction.atomic():
            application.cover_letter_versions.update(is_current=False)
            number = (
                application.cover_letter_versions.order_by("-version_number")
                .values_list("version_number", flat=True)
                .first()
                or 0
            ) + 1
            letter = CoverLetterVersion.objects.create(
                job_application=application,
                version_number=number,
                name=f"{application.company_name} cover letter v{number}",
                content=content,
                model=model,
            )
            letter.template_data = cover_letter_template_data(letter)
            letter.save(update_fields=["template_data", "updated_at"])
        return JsonResponse(serialize_cover_letter(letter), status=201)
    except (
        requests.RequestException,
        KeyError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
    ) as exc:
        return JsonResponse({"error": f"Cover letter generation failed: {exc}"}, status=422)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def cover_letter_detail(request, application_id, letter_id):
    try:
        letter = CoverLetterVersion.objects.get(id=letter_id, job_application_id=application_id)
    except CoverLetterVersion.DoesNotExist:
        return JsonResponse({"error": "Cover letter version was not found."}, status=404)
    if request.method == "DELETE":
        was_current = letter.is_current
        letter.delete()
        if was_current:
            replacement = (
                CoverLetterVersion.objects.filter(job_application_id=application_id)
                .order_by("-version_number")
                .first()
            )
            if replacement:
                replacement.is_current = True
                replacement.save(update_fields=["is_current", "updated_at"])
        return JsonResponse({"ok": True})
    body = json.loads(request.body or "{}")
    if "content" in body:
        letter.content = str(body["content"])
    if "template_data" in body:
        letter.template_data = cover_letter_template_data(letter, body["template_data"])
    if "name" in body:
        letter.name = str(body["name"]).strip()[:200] or letter.name
    if body.get("is_current"):
        CoverLetterVersion.objects.filter(job_application_id=application_id).exclude(
            id=letter.id
        ).update(is_current=False)
        letter.is_current = True
    letter.save()
    return JsonResponse(serialize_cover_letter(letter))


@csrf_exempt
@require_http_methods(["POST"])
def cover_letter_pdf(request, application_id, letter_id):
    """Render the edited cover letter content as a downloadable PDF."""
    try:
        letter = CoverLetterVersion.objects.select_related("job_application").get(
            id=letter_id, job_application_id=application_id
        )
    except CoverLetterVersion.DoesNotExist:
        return JsonResponse({"error": "Cover letter version was not found."}, status=404)
    try:
        body = json.loads(request.body or "{}")
        content = normalize_cover_letter_text(body.get("content", letter.content))
        if not content:
            return JsonResponse({"error": "Cover letter content cannot be empty."}, status=400)
        buffer = BytesIO()
        styles = getSampleStyleSheet()
        body_style = ParagraphStyle(
            "CoverLetterBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15.5,
            textColor=colors.HexColor("#273142"),
            spaceAfter=13,
        )
        line_style = ParagraphStyle("CoverLetterLine", parent=body_style, spaceAfter=0)
        application = letter.job_application
        template = parse_cover_letter_template_data(content)
        fields = cover_letter_template_data(letter, body.get("template_data"))
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=22 * mm,
            leftMargin=22 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
            title=letter.name,
            author=fields["sender_name"],
        )
        name_style = ParagraphStyle(
            "CoverLetterName",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=23,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#111827"),
            spaceAfter=2,
        )
        role_style = ParagraphStyle(
            "CoverLetterRole",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#596575"),
        )
        contact_style = ParagraphStyle("CoverLetterContact", parent=role_style, alignment=TA_RIGHT)
        meta_label_style = ParagraphStyle(
            "CoverLetterMetaLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#635BFF"),
            spaceAfter=2,
        )
        meta_title_style = ParagraphStyle(
            "CoverLetterMetaTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#111827"),
            spaceAfter=1,
        )
        meta_company_style = ParagraphStyle(
            "CoverLetterMetaCompany", parent=role_style, spaceAfter=14
        )
        signature_name_style = ParagraphStyle(
            "CoverLetterSignatureName", parent=body_style, fontName="Helvetica-Bold", spaceAfter=1
        )
        header_left = []
        if fields["sender_name"]:
            header_left.append(Paragraph(pdf_cover_letter_text(fields["sender_name"]), name_style))
        if fields["role"]:
            header_left.append(Paragraph(pdf_cover_letter_text(fields["role"]), role_style))
        header_right = []
        if fields["sender_email"]:
            header_right.append(
                Paragraph(pdf_cover_letter_text(fields["sender_email"]), contact_style)
            )
        if fields["date"]:
            header_right.append(Paragraph(pdf_cover_letter_text(fields["date"]), contact_style))
        header = Table([[header_left, header_right]], colWidths=[100 * mm, 66 * mm])
        header.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 1.5, colors.black),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ]
            )
        )
        application_block = Table(
            [
                [
                    [
                        Paragraph("APPLICATION FOR", meta_label_style),
                        *(
                            [Paragraph(pdf_cover_letter_text(fields["role"]), meta_title_style)]
                            if fields["role"]
                            else []
                        ),
                        *(
                            [
                                Paragraph(
                                    pdf_cover_letter_text(fields["company"]), meta_company_style
                                )
                            ]
                            if fields["company"]
                            else []
                        ),
                    ]
                ]
            ],
            colWidths=[166 * mm],
        )
        application_block.setStyle(
            TableStyle(
                [
                    ("LINEBEFORE", (0, 0), (0, 0), 2.5, colors.HexColor("#635BFF")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        story = [header, Spacer(1, 14), application_block, Spacer(1, 2)]
        for paragraph in re.split(r"\n\s*\n", template["body"]):
            lines = [line.strip() for line in paragraph.splitlines() if line.strip()]
            for line_index, line in enumerate(lines):
                story.append(Paragraph(pdf_cover_letter_text(line), line_style))
                if line_index < len(lines) - 1:
                    story.append(Spacer(1, 2))
            if lines:
                story.append(Spacer(1, 11))
        story.extend(
            [
                Spacer(1, 3),
                Paragraph(pdf_cover_letter_text(template["closing"]), line_style),
                Spacer(1, 12),
            ]
        )
        if fields["sender_name"]:
            story.append(
                Paragraph(pdf_cover_letter_text(fields["sender_name"]), signature_name_style)
            )
        if fields["sender_email"]:
            story.append(Paragraph(pdf_cover_letter_text(fields["sender_email"]), line_style))
        document.build(story)
        buffer.seek(0)
        exported_at = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        filename = re.sub(
            r"[^A-Za-z0-9._-]+",
            "-",
            f"{application.company_name}-cover-letter-v{letter.version_number}-{exported_at}.pdf",
        ).strip("-")
        response = FileResponse(
            buffer, as_attachment=True, filename=filename, content_type="application/pdf"
        )
        response["Cache-Control"] = "no-store, max-age=0"
        response["Pragma"] = "no-cache"
        return response
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        return JsonResponse({"error": f"Cover letter PDF export failed: {exc}"}, status=400)
