"""Authentication middleware bridging JWT headers to Django sessions.

This middleware enables plain Django views to honour Authorization: Bearer
headers issued by SimpleJWT. It mirrors the behaviour exposed by DRF views so
that solver scripts and external clients can rely on consistent authentication
semantics across the project.
"""

from __future__ import annotations

from typing import Callable

from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest, HttpResponse
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken


class JWTHeaderAuthenticationMiddleware:
    """Populate ``request.user`` from Bearer tokens for non-DRF views."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        """Persist downstream callback and set up the JWT authenticator."""
        self.get_response = get_response
        self._auth = JWTAuthentication()

    def __call__(self, request: HttpRequest) -> HttpResponse:
        """Bind the authenticated user from the Authorization header if present."""
        current_user = getattr(request, "user", None)
        if current_user is None or isinstance(current_user, AnonymousUser):
            header_value = request.META.get("HTTP_AUTHORIZATION", "")
            if header_value.startswith("Bearer "):
                raw_token = header_value.split(" ", 1)[1].strip()
                if raw_token:
                    try:
                        validated = self._auth.get_validated_token(raw_token)
                        user = self._auth.get_user(validated)
                    except (InvalidToken, AuthenticationFailed):
                        user = None
                    if user is not None:
                        request.user = user
                        request._cached_user = user

        response = self.get_response(request)
        return response


__all__ = ["JWTHeaderAuthenticationMiddleware"]
