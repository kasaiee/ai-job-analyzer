import json
import re
from datetime import datetime, timezone

from django.db import transaction

from ..models import MemoryNode
from ..serializers import serialize_memory
from . import ai_client


def memory_folder(node_id):
    if not node_id:
        return None
    try:
        return MemoryNode.objects.get(id=node_id, is_leaf=False)
    except (MemoryNode.DoesNotExist, ValueError):
        raise ValueError("Memory folder was not found.")


def validate_memory_parent(node, parent):
    current = parent
    while current:
        if current.id == node.id:
            raise ValueError("A folder cannot be moved into itself or one of its descendants.")
        current = current.parent


def memory_context(include_ids=False):
    leaves = MemoryNode.objects.filter(is_leaf=True).exclude(content="")
    if include_ids:
        return "\n".join(f"- ID {node.id} | {node.name}: {node.content}" for node in leaves)
    return "\n".join(f"- {node.name}: {node.content}" for node in leaves)


def memory_records_for_resume():
    records = []
    for node in (
        MemoryNode.objects.filter(is_leaf=True).exclude(content="").select_related("parent")
    ):
        path = []
        current = node.parent
        while current:
            path.insert(0, current.name)
            current = current.parent
        records.append(
            {
                "id": str(node.id),
                "path": " / ".join(path),
                "title": node.name,
                "content": node.content,
            }
        )
    return records


class MemoryArrangementError(ValueError):
    """Raised when memories cannot be arranged right now."""


def arrange_memories(request, model="sub-gpt-5.6-luna"):
    """Replace the memory tree with an AI-organized hierarchy, keeping an archive."""
    raw_leaves = list(
        MemoryNode.objects.filter(is_leaf=True)
        .exclude(content="")
        .exclude(name__startswith="Archive before arrangement ")
        .order_by("updated_at", "created_at", "id")
    )
    leaves = []
    seen_content = set()
    for node in reversed(raw_leaves):
        key = " ".join(node.content.casefold().split())
        if key and key in seen_content:
            continue
        seen_content.add(key)
        leaves.append(node)
    leaves.reverse()
    if not leaves:
        raise MemoryArrangementError("Add at least one memory before arranging.")
    original = "\n".join(
        f"- [{node.updated_at.isoformat()}] {node.name}: {node.content}" for node in leaves
    )
    prompt = [
        {
            "role": "system",
            "content": """Organize the user's memories into a current, accurate profile without inventing facts. Each input memory includes its last-updated timestamp and inputs are ordered from oldest to newest.

Conflict rules:
- When two memories describe the same mutable attribute but disagree, keep only the newest statement. A newer statement supersedes the older one even when their titles differ. Example: if older English proficiency is Basic and newer proficiency is Intermediate, output only Intermediate as the current English level.
- Treat corrections and updated preferences, proficiency levels, availability, location, target role, compensation, and other current-state facts as newest-wins.
- Preserve both statements only when they are genuinely historical events or can both be true simultaneously; express chronology clearly when relevant.
- Merge duplicates, retain every non-conflicting fact, and never copy archive snapshots into the arranged profile.
- Return each category only once, with unique memory items and no duplicate folders.

Return ONLY JSON: {"groups":[{"name":"category","items":[{"name":"short title","content":"complete current fact"}]}]}.""",
        },
        {"role": "user", "content": original},
    ]
    response = ai_client.ai_completion(request, {"model": model, "messages": prompt}, timeout=120)
    response.raise_for_status()
    data = response.json()["choices"][0]["message"]["content"]
    match = re.search(r"\{[\s\S]*\}", data)
    arranged = json.loads(match.group(0) if match else data)
    with transaction.atomic():
        archive = MemoryNode.objects.create(
            name=f"Archive before arrangement {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            content=original,
            is_leaf=True,
        )
        MemoryNode.objects.filter(is_leaf=True).exclude(id=archive.id).delete()
        # Arrangement replaces the existing hierarchy. Deleting only its
        # leaves leaves empty folders behind and duplicates the directory
        # list each time arrangement is run.
        MemoryNode.objects.filter(is_leaf=False).delete()
        arranged_folders = {}
        seen_items = set()
        for group in arranged.get("groups", []):
            group_name = str(group.get("name") or "Organized memory").strip()[:200]
            folder_key = group_name.casefold()
            parent = arranged_folders.get(folder_key)
            if parent is None:
                parent = MemoryNode.objects.create(name=group_name, is_leaf=False)
                arranged_folders[folder_key] = parent
            for item in group.get("items", []):
                item_name = str(item.get("name") or "Memory").strip()[:200]
                item_content = str(item.get("content") or "").strip()
                item_key = " ".join(item_content.casefold().split())
                if not item_content or item_key in seen_items:
                    continue
                seen_items.add(item_key)
                MemoryNode.objects.create(
                    name=item_name,
                    content=item_content,
                    parent=parent,
                    is_leaf=True,
                )
    return {
        "nodes": [
            serialize_memory(node)
            for node in MemoryNode.objects.filter(parent=None).order_by("name")
        ],
        "archive_id": str(archive.id),
    }
