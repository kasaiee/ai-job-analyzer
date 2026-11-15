"""Production settings.

Requires DJANGO_SECRET_KEY and DJANGO_ALLOWED_HOSTS in the environment;
the process fails fast on startup when either is missing.
"""
import os

from .base import *  # noqa: F401,F403

DEBUG = False

if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY must be set in production.")

ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if host.strip()]
if not ALLOWED_HOSTS:
    raise RuntimeError("DJANGO_ALLOWED_HOSTS must be set in production.")
