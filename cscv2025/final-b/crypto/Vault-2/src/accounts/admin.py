"""Admin registrations for accounts app."""

from __future__ import annotations

from django.contrib import admin

from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    """Admin view for custom User model."""

    list_display = (
        "id",
        "username",
        "role",
        "has_random_state",
        "is_active",
        "is_staff",
        "is_superuser",
    )
    search_fields = ("username",)
    list_filter = ("role", "is_active", "is_staff")

    @staticmethod
    def has_random_state(obj: User) -> bool:  # type: ignore[override]
        return bool(getattr(obj, "has_random_state", lambda: False)())
