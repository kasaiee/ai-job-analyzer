import json
import os
import subprocess
import tempfile
import time
from urllib.parse import urlparse

import requests

from . import providers

AI_ANALYSIS_CONNECT_TIMEOUT = 15
AI_ANALYSIS_READ_TIMEOUT = 300
AI_ANALYSIS_ATTEMPTS = 3
AI_ANALYSIS_RETRY_DELAYS = (1, 3)

PROVIDER_HEADER = "X-AI-API-Provider"
TOKEN_HEADER = "X-AI-API-Token"
URL_HEADER = "X-AI-API-URL"


def ai_settings(request):
    """Resolve the provider adapter plus credentials from request headers."""
    provider = providers.get_provider(request.headers.get(PROVIDER_HEADER, ""))
    api_token = request.headers.get(TOKEN_HEADER, "").strip()
    api_url = (request.headers.get(URL_HEADER, "").strip() or provider.get("base_url", "")).rstrip(
        "/"
    )
    if not api_token and provider.get("requires_key", True):
        raise ValueError("Configure the AI API token in Settings before using AI features.")
    if not api_url:
        raise ValueError("Configure the AI API URL in Settings before using AI features.")
    parsed_url = urlparse(api_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("The AI API URL in Settings is invalid.")
    if "\r" in api_token or "\n" in api_token or "\r" in api_url or "\n" in api_url:
        raise ValueError("The AI API configuration contains invalid characters.")
    return api_url, api_token, provider


def ai_configuration(request):
    api_url, api_token, _provider = ai_settings(request)
    return api_url, api_token


class NormalizedResponse:
    """Exposes a provider response with ``.json()`` in OpenAI Chat Completions shape."""

    def __init__(self, response, normalize):
        self._response = response
        self._normalize = normalize

    def __getattr__(self, name):
        return getattr(self._response, name)

    def json(self):
        return self._normalize(self._response.json())


def _deliver_response(response, provider):
    if providers.is_openai_shaped(provider):
        return response
    return NormalizedResponse(response, provider["normalize_response"])


def request_provider(request):
    """Resolve only the provider adapter for the request (validates settings too)."""
    return ai_settings(request)[2]


def parse_stream_line(provider, line):
    """Return the streamed text token on an SSE line, or None."""
    return provider["parse_stream_line"](line)


def ai_completion(request, payload, **options):
    api_url, api_token, provider = ai_settings(request)
    url, headers, body = provider["build_request"](api_url, api_token, payload)
    response = requests.post(url, headers=headers, json=body, **options)
    return _deliver_response(response, provider)


def list_models(request):
    """Fetch the provider's live model catalog for the settings screen."""
    api_url, api_token, provider = ai_settings(request)
    return provider["list_models"](api_url, api_token)


def ai_analysis_completion(request, payload):
    """Allow long AI jobs and retry transient network/TLS failures safely."""
    last_error = None
    for attempt in range(AI_ANALYSIS_ATTEMPTS):
        try:
            return ai_completion(
                request,
                payload,
                timeout=(AI_ANALYSIS_CONNECT_TIMEOUT, AI_ANALYSIS_READ_TIMEOUT),
            )
        except (requests.Timeout, requests.ConnectionError, requests.exceptions.SSLError) as exc:
            last_error = exc
            if attempt < AI_ANALYSIS_ATTEMPTS - 1:
                time.sleep(AI_ANALYSIS_RETRY_DELAYS[attempt])
    if isinstance(last_error, requests.exceptions.SSLError):
        return ai_completion_with_curl(request, payload)
    raise last_error


class CurlResponse:
    """Small requests.Response-compatible wrapper used by the TLS fallback."""

    def __init__(self, status_code, content, normalize=None):
        self.status_code = status_code
        self.content = content
        self._normalize = normalize or (lambda data: data)

    def raise_for_status(self):
        if self.status_code >= 400:
            preview = self.content.decode("utf-8", errors="replace")[:500]
            raise requests.HTTPError(f"AI provider returned HTTP {self.status_code}: {preview}")

    def json(self):
        return self._normalize(json.loads(self.content.decode("utf-8")))


def curl_config_value(value):
    """Escape a value for curl's double-quoted config-file syntax."""
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


def ai_completion_with_curl(request, payload):
    """Use the system TLS stack when Python/OpenSSL repeatedly fails its handshake."""
    api_url, api_token, provider = ai_settings(request)
    url, headers, body = provider["build_request"](api_url, api_token, payload)
    header_file = None
    response_file = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", prefix="ai-headers-", delete=False) as stream:
            header_file = stream.name
            for name, value in headers.items():
                header = curl_config_value(f"{name}: {value}")
                stream.write(f'header = "{header}"\n')
        with tempfile.NamedTemporaryFile(prefix="ai-response-", delete=False) as stream:
            response_file = stream.name
        result = subprocess.run(
            [
                "curl",
                "--silent",
                "--show-error",
                "--request",
                "POST",
                "--config",
                header_file,
                "--connect-timeout",
                str(AI_ANALYSIS_CONNECT_TIMEOUT),
                "--max-time",
                str(AI_ANALYSIS_READ_TIMEOUT),
                "--output",
                response_file,
                "--write-out",
                "%{http_code}",
                "--data-binary",
                "@-",
                "--url",
                url,
            ],
            input=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            capture_output=True,
            timeout=AI_ANALYSIS_READ_TIMEOUT + AI_ANALYSIS_CONNECT_TIMEOUT + 5,
            check=False,
        )
        if result.returncode != 0:
            error = result.stderr.decode("utf-8", errors="replace").strip()
            if result.returncode == 28:
                raise requests.Timeout(error or "AI provider request timed out.")
            raise requests.ConnectionError(error or f"curl exited with status {result.returncode}.")
        try:
            status_code = int(result.stdout.decode("ascii").strip())
        except ValueError as exc:
            raise requests.ConnectionError(
                "The curl fallback returned an invalid HTTP status."
            ) from exc
        with open(response_file, "rb") as stream:
            content = stream.read()
        return CurlResponse(status_code, content, provider["normalize_response"])
    except subprocess.TimeoutExpired as exc:
        raise requests.Timeout("AI provider request timed out in the curl fallback.") from exc
    except OSError as exc:
        raise requests.ConnectionError(f"Could not start the secure curl fallback: {exc}") from exc
    finally:
        for path in (header_file, response_file):
            if path:
                try:
                    os.unlink(path)
                except FileNotFoundError:
                    pass


def streaming_completion(request, payload):
    """POST a streaming chat completion using the request-bound AI settings."""
    api_url, api_token, provider = ai_settings(request)
    url, headers, body = provider["build_request"](api_url, api_token, payload, stream=True)
    return requests.post(url, headers=headers, json=body, timeout=120, stream=True)
