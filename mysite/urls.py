"""Compatibility shim for deployments importing ``mysite.urls`` from repo root."""

from .mysite.urls import *  # noqa: F401,F403
