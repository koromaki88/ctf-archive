"""Lightweight request-scoped context storage using contextvars.

The RequestIdMiddleware sets the current request_id into a context variable
so that logs can include it even outside the immediate view function.
"""

from __future__ import annotations

import contextvars
from dataclasses import dataclass
from typing import Optional


@dataclass
class RequestContext:
    """Holds request-scoped data including signing metadata."""

    request_id: Optional[str] = None
    sign_source: Optional[str] = None
    session_scalar: Optional[int] = None


_request_ctx_var: contextvars.ContextVar[RequestContext] = contextvars.ContextVar(
    "request_context", default=RequestContext(),
)


def get_request_context() -> RequestContext:
    """Return the current request context instance."""
    return _request_ctx_var.get()


def set_request_id(request_id: Optional[str]) -> None:
    """Set the current request_id in the context."""
    ctx = _request_ctx_var.get()
    ctx.request_id = request_id
    _request_ctx_var.set(ctx)


def set_signing_context(sign_source: Optional[str], session_scalar: Optional[int]) -> None:
    """Store signing metadata in the current request context."""
    ctx = _request_ctx_var.get()
    ctx.sign_source = sign_source
    ctx.session_scalar = session_scalar
    _request_ctx_var.set(ctx)
