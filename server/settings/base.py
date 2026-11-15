"""Shared Django settings. Environment-specific modules import from here."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

# Security keys are read from the environment; no hard-coded fallback values.
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "corsheaders",
    "chat",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]

ROOT_URLCONF = "server.urls"
WSGI_APPLICATION = "server.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    }
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# AI provider (any OpenAI-compatible endpoint). The key stays server-side.
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.example.com/v1")
AI_API_KEY = os.getenv("AI_API_KEY", "")


def origins_from_env(name, defaults):
    """Read a comma-separated list of allowed origins from the environment."""
    return [origin.strip() for origin in os.getenv(name, "").split(",") if origin.strip()] or defaults


CORS_ALLOWED_ORIGINS = origins_from_env("DJANGO_CORS_ORIGINS", ["http://localhost:5173", "http://127.0.0.1:5173"])
CSRF_TRUSTED_ORIGINS = origins_from_env("DJANGO_CORS_ORIGINS", ["http://localhost:5173", "http://127.0.0.1:5173"])
