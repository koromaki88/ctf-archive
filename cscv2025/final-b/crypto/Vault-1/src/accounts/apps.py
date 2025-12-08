"""Django app config for accounts."""

from __future__ import annotations

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """AppConfig for the `accounts` application."""

    name: str = "accounts"
