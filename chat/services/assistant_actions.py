import json
import mimetypes
import re
import uuid

from ..models import Company, CompanyEmployee, CompanyFact, MemoryNode
from ..serializers import serialize_company, serialize_memory


def save_company_blocks(text):
    pattern = re.compile(
        r"(?:```)?company\s*:\s*([^\n`{]+?)\s*(\{[\s\S]*?\})(?:```|(?=\n|$))", re.IGNORECASE
    )
    saved = []
    for match in pattern.finditer(text or ""):
        try:
            data = json.loads(match.group(2).strip())
        except (ValueError, json.JSONDecodeError):
            continue
        name = (data.get("name") or match.group(1)).strip()[:200]
        company = Company.objects.filter(name__iexact=name).first() or Company.objects.create(
            name=name
        )
        for field in (
            "aliases",
            "website",
            "linkedin_url",
            "brand_image_url",
            "industry",
            "size",
            "location",
            "summary",
        ):
            if data.get(field):
                setattr(company, field, data[field])
        company.save()
        for item in data.get("facts", []):
            fact = (item.get("fact") or "").strip()
            if fact:
                CompanyFact.objects.create(
                    company=company,
                    category=item.get("category", "general")[:100],
                    fact=fact,
                    source=item.get("source", "User-provided chat")[:500],
                    confidence=item.get("confidence", "medium")[:20],
                )
        for item in data.get("employees", []):
            person = (item.get("name") or "").strip()
            if person:
                CompanyEmployee.objects.update_or_create(
                    company=company,
                    name=person,
                    defaults={
                        "title": item.get("title", ""),
                        "linkedin_url": item.get("linkedin_url", ""),
                        "notes": item.get("notes", ""),
                        "source": item.get("source", "User-provided chat")[:500],
                    },
                )
        saved.append(serialize_company(company))
    return saved


def save_memory_blocks(text):
    """Apply explicit memory actions emitted by the assistant.

    The original ``memory:`` block remains supported for creating memories.
    Existing memories must be addressed by UUID so similarly named records are
    never changed accidentally.
    """
    action_pattern = re.compile(r"```memory-action\s*\n([\s\S]*?)```", re.IGNORECASE)
    fenced_memory_pattern = re.compile(r"```memory\s*:\s*([^\n`]+)\n([\s\S]*?)```", re.IGNORECASE)
    plain_memory_pattern = re.compile(
        r"^memory\s*:\s*([^\n`]+)\n([\s\S]*?)(?=^memory\s*:|\Z)",
        re.IGNORECASE | re.MULTILINE,
    )
    saved = []

    for match in action_pattern.finditer(text or ""):
        try:
            action_data = json.loads(match.group(1).strip())
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if not isinstance(action_data, dict):
            continue

        action = str(action_data.get("action", "")).lower()
        if action not in {"update", "delete"}:
            continue

        try:
            node_id = uuid.UUID(str(action_data.get("id", "")))
            node = MemoryNode.objects.get(id=node_id, is_leaf=True)
        except (ValueError, MemoryNode.DoesNotExist):
            continue

        if action == "delete":
            deleted_id = str(node.id)
            node.delete()
            saved.append({"id": deleted_id, "action": "delete"})
            continue

        name = str(action_data.get("name", node.name)).strip()[:200]
        content = str(action_data.get("content", node.content)).strip()
        if not name or not content:
            continue
        node.name = name
        node.content = content
        node.save(update_fields=["name", "content", "updated_at"])
        saved.append({**serialize_memory(node), "action": "update"})

    fenced_ranges = []
    for match in fenced_memory_pattern.finditer(text or ""):
        name = match.group(1).strip()[:200]
        content = match.group(2).strip()
        if name and content:
            node = MemoryNode.objects.create(name=name, content=content, is_leaf=True)
            saved.append({**serialize_memory(node), "action": "create"})
            fenced_ranges.append(match.span())

    # Some models omit the requested Markdown fences. Accept line-anchored
    # memory blocks as a fallback while avoiding duplicates from fenced blocks.
    for match in plain_memory_pattern.finditer(text or ""):
        if any(start <= match.start() < end for start, end in fenced_ranges):
            continue
        name = match.group(1).strip()[:200]
        content = match.group(2).strip()
        if name and content:
            node = MemoryNode.objects.create(name=name, content=content, is_leaf=True)
            saved.append({**serialize_memory(node), "action": "create"})
    return saved


def generated_files(text):
    """Parse optional assistant file blocks: ```file: report.txt ... ```"""
    pattern = re.compile(r"```file\s*:\s*([^\n`]+)\n([\s\S]*?)```", re.IGNORECASE)
    files = []
    for match in pattern.finditer(text or ""):
        filename = match.group(1).strip().replace("/", "_").replace("\\", "_")
        if filename and len(filename) <= 120:
            files.append(
                {
                    "name": filename,
                    "content": match.group(2),
                    "mime": mimetypes.guess_type(filename)[0] or "text/plain",
                }
            )
    return files
