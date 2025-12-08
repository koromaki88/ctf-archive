"""URL configuration for the backend project."""

from __future__ import annotations

from django.contrib import admin
from django.urls import include, path

from health.views import healthz

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz, name="healthz"),
    path("api/", include("accounts.urls")),
    path("api/vault/", include("vault.urls")),
]
