"""Compatibility shim for deployments importing ``mysite.settings`` from repo root."""

from .mysite.settings import *  # noqa: F401,F403
