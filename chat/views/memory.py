import json

import requests
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import MemoryNode
from ..serializers import serialize_memory_item
from ..services.memory import (
    MemoryArrangementError,
    arrange_memories,
    memory_folder,
    validate_memory_parent,
)


def memory_breadcrumbs(parent):
    breadcrumbs = []
    current = parent
    while current:
        breadcrumbs.append({"id": str(current.id), "name": current.name})
        current = current.parent
    return list(reversed(breadcrumbs))


def memory_folder_path(node):
    parts = []
    current = node
    while current:
        parts.append(current.name)
        current = current.parent
    return "/".join(reversed(parts))


def sibling_folder(name, parent, exclude_id=None):
    folders = MemoryNode.objects.filter(parent=parent, is_leaf=False, name__iexact=name)
    if exclude_id:
        folders = folders.exclude(id=exclude_id)
    return folders.order_by("created_at", "id").first()


@csrf_exempt
@require_http_methods(["GET", "POST"])
def memory(request):
    if request.method == "GET":
        query = (request.GET.get("q") or "").strip()
        if query:
            items = MemoryNode.objects.filter(
                Q(name__icontains=query) | Q(content__icontains=query)
            ).order_by("is_leaf", "name")[:100]
            folders = [
                serialize_memory_item(node, include_path=True)
                for node in items
                if not node.is_leaf
            ]
            memories = [
                serialize_memory_item(node, include_path=True) for node in items if node.is_leaf
            ]
            return JsonResponse({"folders": folders, "memories": memories, "breadcrumbs": []})
        try:
            parent = memory_folder(request.GET.get("parent"))
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=404)
        items = MemoryNode.objects.filter(parent=parent).order_by("is_leaf", "name")
        folders = [serialize_memory_item(node) for node in items if not node.is_leaf]
        memories = [serialize_memory_item(node) for node in items if node.is_leaf]
        return JsonResponse(
            {"folders": folders, "memories": memories, "breadcrumbs": memory_breadcrumbs(parent)}
        )
    body = json.loads(request.body or "{}")
    name = (body.get("name") or "").strip()
    content = body.get("content", "").strip()
    is_leaf = bool(body.get("is_leaf", True))
    if not name:
        return JsonResponse({"error": "Memory name is required."}, status=400)
    try:
        parent = memory_folder(body.get("parent_id"))
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    if not is_leaf:
        existing = sibling_folder(name, parent)
        if existing:
            return JsonResponse(serialize_memory_item(existing), status=200)
    node = MemoryNode.objects.create(name=name, content=content, is_leaf=is_leaf, parent=parent)
    return JsonResponse(serialize_memory_item(node), status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def memory_capture(request):
    if request.method == "GET":
        folders = MemoryNode.objects.filter(is_leaf=False).select_related("parent").order_by("name")
        paths = sorted({memory_folder_path(folder) for folder in folders}, key=str.casefold)
        return JsonResponse({"paths": paths})

    body = json.loads(request.body or "{}")
    name = str(body.get("name") or "").strip()[:200]
    content = str(body.get("content") or "").strip()
    raw_path = str(body.get("path") or "").strip()
    path_parts = [
        part.strip()[:200] for part in raw_path.replace("\\", "/").split("/") if part.strip()
    ]
    if not name:
        return JsonResponse({"error": "Memory title is required."}, status=400)
    if not content:
        return JsonResponse({"error": "Selected text is required."}, status=400)

    with transaction.atomic():
        parent = None
        for part in path_parts:
            folder = sibling_folder(part, parent)
            if folder is None:
                folder = MemoryNode.objects.create(name=part, is_leaf=False, parent=parent)
            parent = folder
        node = MemoryNode.objects.create(name=name, content=content, is_leaf=True, parent=parent)
    return JsonResponse(serialize_memory_item(node), status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def memory_detail(request, node_id):
    try:
        node = MemoryNode.objects.get(id=node_id)
    except MemoryNode.DoesNotExist:
        return JsonResponse({"error": "Memory item was not found."}, status=404)
    if request.method == "DELETE":
        node.delete()
        return JsonResponse({"ok": True})
    body = json.loads(request.body or "{}")
    name = str(body.get("name", node.name)).strip()
    if not name:
        return JsonResponse({"error": "Memory name is required."}, status=400)
    try:
        parent = memory_folder(body.get("parent_id")) if "parent_id" in body else node.parent
        validate_memory_parent(node, parent)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    if not node.is_leaf:
        existing = sibling_folder(name, parent, exclude_id=node.id)
        if existing:
            return JsonResponse(
                {"error": "A folder with this name already exists here."}, status=409
            )
    node.name = name
    node.content = str(body.get("content", node.content)).strip() if node.is_leaf else ""
    node.parent = parent
    node.save()
    return JsonResponse(serialize_memory_item(node))


@csrf_exempt
@require_http_methods(["POST"])
def memory_bulk(request):
    body = json.loads(request.body or "{}")
    item_ids = body.get("item_ids") or []
    if not isinstance(item_ids, list) or not item_ids:
        return JsonResponse({"error": "Select at least one memory item."}, status=400)
    action = body.get("action")
    if action == "delete" and body.get("all") is True:
        MemoryNode.objects.all().delete()
        return JsonResponse({"ok": True, "deleted": True})
    items = list(MemoryNode.objects.filter(id__in=item_ids))
    if len(items) != len(set(item_ids)):
        return JsonResponse({"error": "One or more memory items were not found."}, status=404)
    if action == "delete":
        MemoryNode.objects.filter(id__in=item_ids).delete()
        return JsonResponse({"ok": True})
    if action == "move":
        try:
            parent = memory_folder(body.get("parent_id"))
            for node in items:
                validate_memory_parent(node, parent)
                if not node.is_leaf and sibling_folder(node.name, parent, exclude_id=node.id):
                    return JsonResponse(
                        {"error": "A folder with this name already exists here."}, status=409
                    )
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=400)
        MemoryNode.objects.filter(id__in=item_ids).update(parent=parent)
        return JsonResponse({"ok": True})
    return JsonResponse({"error": "Unsupported memory bulk action."}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def memory_arrange(request):
    try:
        return JsonResponse(arrange_memories(request))
    except MemoryArrangementError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except (requests.RequestException, ValueError, json.JSONDecodeError, KeyError) as exc:
        return JsonResponse({"error": f"Memory arrangement failed: {exc}"}, status=502)


MEMORY_EXPORT_FORMAT = "ai-job-analyzer-memory"


@require_http_methods(["GET"])
def memory_export(request):
    nodes = MemoryNode.objects.order_by("created_at", "id")
    return JsonResponse(
        {
            "format": MEMORY_EXPORT_FORMAT,
            "version": 1,
            "items": [
                {
                    "id": str(node.id),
                    "parent_id": str(node.parent_id) if node.parent_id else None,
                    "name": node.name,
                    "content": node.content,
                    "is_leaf": node.is_leaf,
                    "created_at": node.created_at.isoformat(),
                    "updated_at": node.updated_at.isoformat(),
                }
                for node in nodes
            ],
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def memory_import(request):
    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Import file is not valid JSON."}, status=400)
    items = body.get("items") if body.get("format") == MEMORY_EXPORT_FORMAT else None
    if not isinstance(items, list):
        return JsonResponse({"error": "Not a memory export file."}, status=400)
    try:
        by_id = {str(item["id"]): item for item in items}
        existing = {str(pk) for pk in MemoryNode.objects.values_list("id", flat=True)}
        pending = [item for key, item in by_id.items() if key not in existing]
        created = 0
        with transaction.atomic():
            known = set(existing)
            while pending:
                ready = [
                    item
                    for item in pending
                    if not item.get("parent_id") or str(item["parent_id"]) in known
                ]
                if not ready:
                    return JsonResponse({"error": "Export file has missing parents."}, status=400)
                for item in ready:
                    node = MemoryNode.objects.create(
                        id=item["id"],
                        parent_id=item.get("parent_id"),
                        name=str(item["name"])[:200],
                        content=str(item.get("content") or ""),
                        is_leaf=bool(item.get("is_leaf", True)),
                    )
                    MemoryNode.objects.filter(id=node.id).update(
                        created_at=item.get("created_at") or node.created_at,
                        updated_at=item.get("updated_at") or node.updated_at,
                    )
                    known.add(str(item["id"]))
                    created += 1
                ready_ids = {str(item["id"]) for item in ready}
                pending = [item for item in pending if str(item["id"]) not in ready_ids]
    except (KeyError, TypeError, ValueError) as exc:
        return JsonResponse({"error": f"Invalid memory export: {exc}"}, status=400)
    return JsonResponse({"created": created, "skipped": len(by_id) - created})
