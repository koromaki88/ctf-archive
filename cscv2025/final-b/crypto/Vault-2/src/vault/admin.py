"""Admin registrations for vault models."""

from __future__ import annotations

from django.contrib import admin

from vault.models import VaultSecret, VaultServerKey, VaultSession


@admin.register(VaultServerKey)
class VaultServerKeyAdmin(admin.ModelAdmin):
    """Read-only view of the server key."""

    readonly_fields = ("scalar", "public_x", "public_y", "created_at", "updated_at")


@admin.register(VaultSession)
class VaultSessionAdmin(admin.ModelAdmin):
    """Inspect vault sessions."""

    list_display = ("user", "signature_budget", "created_at", "updated_at")
    search_fields = ("user__username",)


@admin.register(VaultSecret)
class VaultSecretAdmin(admin.ModelAdmin):
    """Inspect vault secrets."""

    list_display = ("owner", "updated_at")
    search_fields = ("owner",)
