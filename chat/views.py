import json
import requests
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Conversation, Message

def serialize_conversation(c):
    return {"id": str(c.id), "title": c.title, "model": c.model, "updated_at": c.updated_at.isoformat(), "messages": [{"id": m.id, "role": m.role, "content": m.content} for m in c.messages.order_by("created_at")]}

@require_http_methods(["GET", "POST"])
def conversations(request):
    if request.method == "POST":
        body = json.loads(request.body or "{}")
        c = Conversation.objects.create(model=body.get("model", "sub-gpt-5.6-luna"))
        return JsonResponse(serialize_conversation(c), status=201)
    return JsonResponse({"conversations": [serialize_conversation(c) for c in Conversation.objects.order_by("-updated_at")[:50]]})

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
        body = json.loads(request.body or "{}"); text = (body.get("message") or "").strip(); model = body.get("model", "sub-gpt-5.6-luna")
        if not text: return JsonResponse({"error": "Message cannot be empty."}, status=400)
        c = Conversation.objects.get(id=body["conversation_id"]) if body.get("conversation_id") else Conversation.objects.create(model=model)
        c.model = model
        if c.messages.count() == 0: c.title = text[:48]
        c.save(update_fields=["model", "title", "updated_at"])
        Message.objects.create(conversation=c, role="user", content=text)
        messages = [{"role": m.role, "content": m.content} for m in c.messages.order_by("created_at")]
        r = requests.post(f"{settings.MIRZA_BASE_URL.rstrip('/')}/chat/completions", headers={"Authorization": f"Bearer {settings.MIRZA_API_KEY}", "Content-Type": "application/json"}, json={"model": model, "messages": messages}, timeout=120)
        if r.status_code == 401:
            return JsonResponse({"error": "Mirza rejected the API key (401). Check MIRZA_API_KEY in .env and restart Django."}, status=502)
        r.raise_for_status(); answer = r.json()["choices"][0]["message"]["content"]
        Message.objects.create(conversation=c, role="assistant", content=answer); c.save(update_fields=["updated_at"])
        return JsonResponse({"conversation_id": str(c.id), "message": {"role": "assistant", "content": answer}})
    except requests.RequestException as exc: return JsonResponse({"error": f"Mirza request failed: {exc}"}, status=502)
    except (Conversation.DoesNotExist, KeyError, ValueError, json.JSONDecodeError) as exc: return JsonResponse({"error": f"Invalid request: {exc}"}, status=400)
