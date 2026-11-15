"""AI settings endpoints: provider model catalog for the settings screen."""

import requests
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from ..services import ai_client


@require_http_methods(["GET"])
def ai_models(request):
    try:
        return JsonResponse({"models": ai_client.list_models(request)})
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except requests.RequestException as exc:
        return JsonResponse({"error": f"Could not fetch the model list: {exc}"}, status=502)
    except (KeyError, TypeError, AttributeError) as exc:
        return JsonResponse(
            {"error": f"The provider returned an unexpected model list: {exc}"}, status=502
        )
