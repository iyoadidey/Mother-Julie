"""Compatibility shim for deployments importing ``mysite.wsgi`` from repo root."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mysite.settings")

application = get_wsgi_application()
