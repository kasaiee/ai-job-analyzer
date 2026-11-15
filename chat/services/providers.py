"""Per-provider adapters for the AI APIs selectable in Settings.

Every adapter translates the app's internal OpenAI-style payload —
``{"model", "messages", ...}`` plus ``{"stream": True}`` for chat — into the
provider's wire format, and converts the provider's response back into the
OpenAI Chat Completions shape. That keeps every view parsing the same
normalized structure regardless of which provider the user picked.

Providers whose APIs are already OpenAI-compatible (OpenRouter, Groq,
Mistral, DeepSeek, xAI, Ollama, and any custom endpoint) share the first
adapter. Anthropic and Google Gemini use their native wire formats.
"""

import json

import requests

ANTHROPIC_VERSION = "2023-06-01"
ANTHROPIC_DEFAULT_MAX_TOKENS = 8192
GEMINI_DEFAULT_MODEL = "gemini-2.0-flash"
MODEL_LIST_TIMEOUT = 30

CUSTOM_PROVIDER_ID = "custom"


def _base_headers(api_token):
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        # A fresh TLS connection is more reliable after an upstream EOF than
        # attempting to reuse a connection from the pool.
        "Connection": "close",
    }
    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"
    return headers


def _split_system_messages(payload):
    system_parts, messages = [], []
    for message in payload.get("messages", []):
        if message.get("role") == "system":
            system_parts.append(message.get("content", ""))
        else:
            messages.append({"role": message.get("role"), "content": message.get("content", "")})
    return system_parts, messages


def _openai_build_request(api_url, api_token, payload, stream=False):
    return f"{api_url}/chat/completions", _base_headers(api_token), payload


def _openai_normalize_response(data):
    return data


def _openai_parse_stream_line(line):
    if line.startswith("data:"):
        line = line[5:].strip()
    if line == "[DONE]":
        return None
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        return None
    choice = (data.get("choices") or [{}])[0]
    token = (choice.get("delta") or {}).get("content") or (choice.get("message") or {}).get(
        "content"
    )
    return token or None


def _openai_list_models(api_url, api_token):
    response = requests.get(
        f"{api_url}/models", headers=_base_headers(api_token), timeout=MODEL_LIST_TIMEOUT
    )
    response.raise_for_status()
    items = response.json().get("data") or []
    return [{"id": item["id"], "label": item["id"]} for item in items if item.get("id")]


def _anthropic_build_request(api_url, api_token, payload, stream=False):
    headers = {
        "x-api-key": api_token,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Connection": "close",
    }
    system_parts, messages = _split_system_messages(payload)
    body = {
        "model": payload.get("model"),
        "max_tokens": payload.get("max_tokens", ANTHROPIC_DEFAULT_MAX_TOKENS),
        "messages": messages,
    }
    if stream:
        body["stream"] = True
    if system_parts:
        body["system"] = "\n\n".join(system_parts)
    return f"{api_url}/v1/messages", headers, body


def _anthropic_normalize_response(data):
    content = "".join(
        block.get("text") or "" for block in data.get("content", []) if block.get("type") == "text"
    )
    return {"choices": [{"message": {"content": content}}]}


def _anthropic_parse_stream_line(line):
    if line.startswith("data:"):
        line = line[5:].strip()
    if line == "[DONE]":
        return None
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        return None
    if data.get("type") != "content_block_delta":
        return None
    delta = data.get("delta") or {}
    return (delta.get("text") or "") or None


def _anthropic_list_models(api_url, api_token):
    headers = {"x-api-key": api_token, "anthropic-version": ANTHROPIC_VERSION}
    response = requests.get(f"{api_url}/v1/models", headers=headers, timeout=MODEL_LIST_TIMEOUT)
    response.raise_for_status()
    items = response.json().get("data") or []
    return [
        {"id": item["id"], "label": item.get("display_name") or item["id"]}
        for item in items
        if item.get("id")
    ]


def _gemini_build_request(api_url, api_token, payload, stream=False):
    model = payload.get("model") or GEMINI_DEFAULT_MODEL
    action = "streamGenerateContent?alt=sse&" if stream else "generateContent?"
    url = f"{api_url}/v1beta/models/{model}:{action}key={api_token}"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Connection": "close",
    }
    system_parts, messages = _split_system_messages(payload)
    contents = []
    for message in messages:
        role = "model" if message["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": message.get("content", "")}]})
    body = {"contents": contents}
    if system_parts:
        body["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}
    if payload.get("max_tokens"):
        body["generationConfig"] = {"maxOutputTokens": payload["max_tokens"]}
    return url, headers, body


def _gemini_content_text(content):
    parts = (content or {}).get("parts") or []
    return "".join(part.get("text") or "" for part in parts)


def _gemini_normalize_response(data):
    candidates = data.get("candidates") or [{}]
    content = _gemini_content_text(candidates[0].get("content"))
    return {"choices": [{"message": {"content": content}}]}


def _gemini_parse_stream_line(line):
    if line.startswith("data:"):
        line = line[5:].strip()
    if line == "[DONE]":
        return None
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        return None
    candidates = data.get("candidates") or [{}]
    return _gemini_content_text(candidates[0].get("content")) or None


def _gemini_list_models(api_url, api_token):
    response = requests.get(f"{api_url}/v1beta/models?key={api_token}", timeout=MODEL_LIST_TIMEOUT)
    response.raise_for_status()
    items = response.json().get("models") or []
    return [
        {"id": item["name"].split("/")[-1], "label": item.get("displayName") or item["name"]}
        for item in items
        if item.get("name")
    ]


def _openai_provider(label, base_url, requires_key=True):
    return {
        "label": label,
        "base_url": base_url,
        "requires_key": requires_key,
        "build_request": _openai_build_request,
        "normalize_response": _openai_normalize_response,
        "parse_stream_line": _openai_parse_stream_line,
        "list_models": _openai_list_models,
    }


PROVIDERS = {
    CUSTOM_PROVIDER_ID: _openai_provider("Custom (OpenAI-compatible)", "", True),
    "openai": _openai_provider("OpenAI", "https://api.openai.com/v1"),
    "anthropic": {
        "label": "Anthropic (Claude)",
        "base_url": "https://api.anthropic.com",
        "requires_key": True,
        "build_request": _anthropic_build_request,
        "normalize_response": _anthropic_normalize_response,
        "parse_stream_line": _anthropic_parse_stream_line,
        "list_models": _anthropic_list_models,
    },
    "gemini": {
        "label": "Google Gemini",
        "base_url": "https://generativelanguage.googleapis.com",
        "requires_key": True,
        "build_request": _gemini_build_request,
        "normalize_response": _gemini_normalize_response,
        "parse_stream_line": _gemini_parse_stream_line,
        "list_models": _gemini_list_models,
    },
    "openrouter": _openai_provider("OpenRouter", "https://openrouter.ai/api/v1"),
    "groq": _openai_provider("Groq", "https://api.groq.com/openai/v1"),
    "mistral": _openai_provider("Mistral AI", "https://api.mistral.ai/v1"),
    "deepseek": _openai_provider("DeepSeek", "https://api.deepseek.com/v1"),
    "xai": _openai_provider("xAI (Grok)", "https://api.x.ai/v1"),
    "ollama": _openai_provider("Ollama (local)", "http://localhost:11434/v1", requires_key=False),
}


def is_openai_shaped(provider):
    """True when the provider already speaks the OpenAI Chat Completions format."""
    return provider["normalize_response"] is _openai_normalize_response


def get_provider(provider_id):
    """Return the adapter for a provider id, raising ValueError when unknown."""
    provider_id = (provider_id or "").strip().lower() or CUSTOM_PROVIDER_ID
    provider = PROVIDERS.get(provider_id)
    if provider is None:
        known = ", ".join(sorted(PROVIDERS))
        raise ValueError(f'Unknown AI provider "{provider_id}". Supported providers: {known}.')
    return provider
