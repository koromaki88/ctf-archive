"""Simple health endpoint for liveness checks."""

from __future__ import annotations

from typing import Any

from django.http import HttpRequest, JsonResponse


def healthz(request: HttpRequest) -> JsonResponse:
    """Return a basic JSON liveness response.

    This endpoint intentionally avoids authentication for container health checks.
    """
    data: dict[str, Any] = {"status": "ok"}
    return JsonResponse(data)
