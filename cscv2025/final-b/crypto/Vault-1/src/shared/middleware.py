"""Django middleware for propagating a request ID and rate limit headers.

The middleware reads the X-Request-Id header if supplied or generates a new
UUID v4 value. The chosen ID is placed on the request object, stored in a
contextvar, and echoed back on the response as X-Request-Id.

Rate limit headers added by throttle classes are also propagated to responses
to help players debug rate limiting issues.
"""

from __future__ import annotations

import uuid
from typing import Callable

from django.http import HttpRequest, HttpResponse

from .request_context import set_request_id


class RequestIdMiddleware:
    """Attach a stable request ID to every request/response cycle."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        """Store the downstream response callable for later invocation."""
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:  # pragma: no cover - thin wrapper
        """Apply or generate a request ID and propagate it to the response."""
        incoming = request.META.get("HTTP_X_REQUEST_ID")
        request_id = incoming or str(uuid.uuid4())
        setattr(request, "request_id", request_id)
        set_request_id(request_id)
        response = self.get_response(request)
        response["X-Request-Id"] = request_id
        return response


class RateLimitHeaderMiddleware:
    """Propagate rate limit headers from request.META to response.

    Throttle classes store rate limit information in request.META during
    the throttle check. This middleware copies those headers to the response
    so players can see their remaining quota and debug 429 errors.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        """Store the downstream response callable for later invocation."""
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:  # pragma: no cover - thin wrapper
        """Copy rate limit headers from request.META to response."""
        response = self.get_response(request)

        # Copy rate limit headers if they were set by throttle classes
        rate_limit_headers = [
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
        ]

        for header_name in rate_limit_headers:
            value = request.META.get(header_name)
            if value is not None:
                response[header_name] = value

        return response
