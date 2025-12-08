"""Middleware that exposes vault session metadata to request context."""

from __future__ import annotations

from typing import Callable

from django.http import HttpRequest, HttpResponse

from shared.request_context import set_signing_context
from vault.models import VaultSession

_SIGN_SOURCE_SESSION = "session"


def _bytes_to_int(raw: bytes | memoryview) -> int:
    return int.from_bytes(bytes(raw), "big")


class VaultSessionMiddleware:
    """Attach vault session information to the request context."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        user = getattr(request, "user", None)
        session = None
        if user is not None and getattr(user, "is_authenticated", False):
            session = VaultSession.objects.filter(user=user).first()

        if session is not None:
            scalar = _bytes_to_int(session.session_scalar)
            set_signing_context(_SIGN_SOURCE_SESSION, scalar)
            setattr(request, "vault_session", session)
        else:
            set_signing_context(None, None)

        return self.get_response(request)
