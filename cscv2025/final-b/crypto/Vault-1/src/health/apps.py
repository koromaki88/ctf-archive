"""Django app configuration for health-checks."""

from __future__ import annotations

from django.apps import AppConfig


class HealthConfig(AppConfig):
    """AppConfig for the `health` application."""

    name: str = "health"
