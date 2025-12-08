"""Structured JSON logging utilities and request ID propagation.

This module provides a minimal JSON formatter and a logging filter that
injects the current request_id into log records. The request_id is set by
the `shared.middleware.RequestIdMiddleware` using a context variable.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from .request_context import get_request_context


class JsonFormatter(logging.Formatter):
    """Render log records as single-line JSON objects.

    The formatter captures basic fields plus request_id if available. This
    output is friendly to log aggregation systems and easy to parse.
    """

    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        """Serialize the provided log record to compact JSON."""
        payload: dict[str, object] = {
            "timestamp": datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Attach request_id if present in context
        ctx = get_request_context()
        if ctx.request_id is not None:
            payload["request_id"] = ctx.request_id
        return json.dumps(payload, separators=(",", ":"))


class RequestIdFilter(logging.Filter):
    """Inject request_id attribute into log records when available."""

    def filter(self, record: logging.LogRecord) -> bool:  # type: ignore[override]
        """Ensure every log record exposes the current request ID."""
        ctx = get_request_context()
        setattr(record, "request_id", ctx.request_id)
        return True
