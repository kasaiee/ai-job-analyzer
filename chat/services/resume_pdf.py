import re
from pathlib import Path
from urllib.parse import urlparse

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, PageBreak, Paragraph, Table, TableStyle


def pdf_text(value):
    from xml.sax.saxutils import escape

    escaped = escape(str(value or "")).replace("\r\n", "\n").replace("\r", "\n")
    escaped = escaped.replace("\n", "<br/> ")
    return re.sub(r"(\[ADD [^\]]+\])", r'<font color="#c62828">\1</font>', escaped)


def pdf_contact_link(value, target):
    from xml.sax.saxutils import escape, quoteattr

    visible_text = escape(str(value or ""))
    if not target or re.search(r"\[ADD [^\]]+\]", str(value or "")):
        return pdf_text(value)
    return f'<link href={quoteattr(target)} color="#000000"><u>{visible_text}</u></link>'


def pdf_web_link_target(value):
    visible_text = str(value or "").strip()
    if not visible_text or re.search(r"\[ADD [^\]]+\]", visible_text):
        return None
    target = (
        visible_text
        if re.match(r"^[a-z][a-z\d+.-]*:", visible_text, re.IGNORECASE)
        else f"https://{visible_text}"
    )
    return target if urlparse(target).scheme.lower() in {"http", "https"} else None


def pdf_web_link_text(value):
    """Shorten a contact URL for display while retaining its full link target."""
    visible_text = str(value or "").strip()
    visible_text = re.sub(r"^(?:https?://)?www\.", "", visible_text, flags=re.IGNORECASE)
    return re.sub(r"^https?://", "", visible_text, flags=re.IGNORECASE)


def pdf_contact_items(contact):
    """Return ReportLab-safe contact values matching the preview's inline contact items."""
    items = []
    email = str(contact.get("email") or "").strip()
    phone = str(contact.get("phone") or "").strip()
    location = str(contact.get("location") or "").strip()

    if email:
        email_target = None if re.search(r"\[ADD [^\]]+\]", email) else f"mailto:{email}"
        items.append(pdf_contact_link(email, email_target))
    phone_and_location = []
    if phone:
        dialable_phone = re.sub(r"[^\d+]", "", phone)
        phone_target = f"tel:{dialable_phone}" if dialable_phone else None
        phone_and_location.append(pdf_contact_link(phone, phone_target))
    if location:
        phone_and_location.append(pdf_text(location))
    if phone_and_location:
        items.append(
            "".join(
                [
                    phone_and_location[0],
                    (" | " + phone_and_location[1]) if len(phone_and_location) > 1 else "",
                ]
            )
        )
    for link in contact.get("links") or []:
        if link:
            display_text = pdf_web_link_text(link)
            items.append(pdf_contact_link(display_text, pdf_web_link_target(link)))
    return items


def pdf_contact_separator(body_symbols, contact_index):
    """Match the preview's inline contact separator policy (currently no added separator)."""
    return (body_symbols or {}).get(f"contact.{contact_index}.separator", "")


def format_education_period(period):
    """Standardize resume dates with three-letter English month names."""
    short_month_names = (
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    )
    full_month_names = (
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    )

    def year_month(match):
        return f"{short_month_names[int(match.group(2)) - 1]} {match.group(1)}"

    def month_year(match):
        return f"{short_month_names[int(match.group(1)) - 1]} {match.group(2)}"

    def full_month(match):
        index = next(
            index
            for index, name in enumerate(full_month_names)
            if name.lower() == match.group(0).lower()
        )
        return short_month_names[index]

    formatted = re.sub(r"\b(\d{4})[-/](0?[1-9]|1[0-2])\b", year_month, str(period or ""))
    formatted = re.sub(r"\b(0?[1-9]|1[0-2])/(\d{4})\b", month_year, formatted)
    return re.sub(
        rf"\b(?:{'|'.join(full_month_names)})\b", full_month, formatted, flags=re.IGNORECASE
    )


def register_resume_pdf_fonts():
    """Register embeddable system fonts for selectable Unicode resume text."""
    font_sets = (
        ("liberation", "LiberationSans-Regular.ttf", "LiberationSans-Bold.ttf"),
        ("dejavu", "DejaVuSans.ttf", "DejaVuSans-Bold.ttf"),
    )
    base_dir = Path("/usr/share/fonts/truetype")
    font_files = {}
    for folder, regular, bold in font_sets:
        if (base_dir / folder / regular).is_file() and (base_dir / folder / bold).is_file():
            font_files = {
                "ResumeSans": base_dir / folder / regular,
                "ResumeSans-Bold": base_dir / folder / bold,
            }
            break
    if not font_files:
        return False
    for font_name, font_path in font_files.items():
        if font_name not in pdfmetrics.getRegisteredFontNames() and font_path.is_file():
            pdfmetrics.registerFont(TTFont(font_name, str(font_path)))
    if all(name in pdfmetrics.getRegisteredFontNames() for name in font_files):
        pdfmetrics.registerFontFamily(
            "ResumeSans",
            normal="ResumeSans",
            bold="ResumeSans-Bold",
            italic="ResumeSans",
            boldItalic="ResumeSans-Bold",
        )
    return all(name in pdfmetrics.getRegisteredFontNames() for name in font_files)


def build_resume_pdf_header(
    contact, styles, body_symbols=None, font_name="Helvetica", bold_font_name="Helvetica-Bold"
):
    """Build a single-column header (name, headline, one contact line) that ATS parsers read in order."""
    name_style = ParagraphStyle(
        "ResumeName",
        parent=styles["Title"],
        fontName=bold_font_name,
        fontSize=20,
        leading=24,
        alignment=TA_LEFT,
        textColor=colors.black,
        spaceAfter=2,
    )
    position_style = ParagraphStyle(
        "ResumePosition",
        parent=styles["Normal"],
        fontName=bold_font_name,
        fontSize=11,
        leading=14,
        alignment=TA_LEFT,
        textColor=colors.black,
    )
    contact_style = ParagraphStyle(
        "Contact",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=9.5,
        leading=13,
        alignment=TA_LEFT,
        textColor=colors.black,
        spaceBefore=3,
    )
    symbols = body_symbols or {}
    contact_line = ""
    for index, item in enumerate(pdf_contact_items(contact)):
        if index:
            contact_line += pdf_text(symbols.get(f"contact.{index}.separator", " | "))
        contact_line += item
    rows = [[Paragraph(pdf_text(contact.get("name") or "[ADD NAME]"), name_style)]]
    if contact.get("headline"):
        rows.append([Paragraph(pdf_text(contact["headline"]), position_style)])
    if contact_line:
        rows.append([Paragraph(contact_line, contact_style)])
    header = Table(rows, colWidths=[178 * mm - 12], hAlign="LEFT")
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
                ("LINEBELOW", (0, -1), (-1, -1), 1.5, colors.black),
            ]
        )
    )
    return header


def balance_resume_pdf_pages(story, document, first_page_share=0.55):
    """Insert one page break between entries so a two-page resume fills both pages."""
    frame_width = document.width - 12
    frame_height = document.height - 12
    positions = []
    used = 0
    previous_space = 0
    for index, flowable in enumerate(story):
        _, height = flowable.wrap(frame_width, frame_height * 10)
        space_before = max(flowable.getSpaceBefore(), previous_space) if index else 0
        style_name = getattr(getattr(flowable, "style", None), "name", "")
        after_rule = index > 0 and isinstance(story[index - 1], HRFlowable)
        is_entry = style_name in {"Section", "Entry"} or getattr(flowable, "is_resume_entry", False)
        can_break = index > 0 and is_entry and not after_rule
        positions.append((index, used + space_before, can_break))
        used += space_before + height
        previous_space = flowable.getSpaceAfter()
    total = used
    if total <= frame_height or total > frame_height * 2:
        return story
    target = total * first_page_share
    candidates = [
        (abs(offset - target), index)
        for index, offset, can_break in positions
        if can_break and offset <= frame_height and total - offset <= frame_height
    ]
    if not candidates:
        return story
    _, break_index = min(candidates)
    return story[:break_index] + [PageBreak()] + story[break_index:]
