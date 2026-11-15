import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import BrowserContext


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
            return JsonResponse(
                {"error": "A page URL and captured page content are required."}, status=400
            )
        captured = BrowserContext.objects.create(
            url=url, title=title, text=text, selection=selection, screenshot=screenshot
        )
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
    return JsonResponse(
        {
            "context": {
                "url": captured.url,
                "title": captured.title,
                "text": captured.text,
                "selection": captured.selection,
                "screenshot": captured.screenshot,
            }
        }
    )
