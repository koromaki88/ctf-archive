"""App configuration for the vault service."""

from __future__ import annotations

from django.apps import AppConfig


class VaultConfig(AppConfig):
    """Configure the vault application."""

    default_auto_field = "django.db.models.BigAutoField"  # type: ignore[assignment]
    name = "vault"
