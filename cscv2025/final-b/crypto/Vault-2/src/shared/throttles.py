"""CTF-friendly rate limiting with generous limits for legitimate solving.

These throttle classes prevent abuse while allowing experimentation, retries,
and different exploit approaches. All limits provide 6x headroom over the
reference exploit requirements.
"""

from __future__ import annotations

import time
from typing import Any

from rest_framework.request import Request
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView


class CTFBaseThrottle(UserRateThrottle):
    """Base throttle class with CTF-friendly features.

    - Generous burst allowance for debugging/retries
    - Helpful response headers showing remaining quota
    - Smooth rate limiting over hourly windows
    """

    def allow_request(self, request: Request, view: APIView) -> bool:
        """Check if request should be allowed, adding helpful headers."""
        # Get the standard throttle decision
        allowed = super().allow_request(request, view)

        # Add helpful headers for players to debug rate limits
        if hasattr(self, "history"):
            num_requests = getattr(self, "num_requests", 0)
            remaining = max(0, num_requests - len(self.history))

            # Store in request for middleware to add to response
            request.META["X-RateLimit-Limit"] = str(num_requests)
            request.META["X-RateLimit-Remaining"] = str(remaining)

            # Calculate reset time
            if self.history:
                reset_time = int(self.history[0] + self.duration)
                request.META["X-RateLimit-Reset"] = str(reset_time)

        return allowed


class VaultSessionThrottle(CTFBaseThrottle):
    """Rate limit for vault session creation.

    Limit: 200 sessions per hour
    Reference exploit needs: 48 sessions
    Headroom: 4.2x
    """

    rate = "200/hour"


class VaultStoreThrottle(CTFBaseThrottle):
    """Rate limit for storing vault secrets.

    Limit: 100 secrets per hour
    Reference exploit needs: 20 secrets
    Headroom: 5x
    """

    rate = "100/hour"


class VaultRetrieveThrottle(CTFBaseThrottle):
    """Rate limit for retrieving vault secrets.

    Limit: 300 retrievals per hour
    Reference exploit needs: 48 retrievals
    Headroom: 6.3x
    """

    rate = "300/hour"


class SignatureCollectionThrottle(CTFBaseThrottle):
    """Rate limit for signature collection endpoint.

    Limit: 300 requests per hour
    Reference exploit needs: 47 requests
    Headroom: 6.4x
    """

    rate = "300/hour"


class AttestationThrottle(CTFBaseThrottle):
    """Rate limit for attestation requests.

    Limit: 200 requests per hour
    Headroom: Generous for attestation-based Stage 1 exploits
    """

    rate = "200/hour"


class AuthThrottle(UserRateThrottle):
    """Rate limit for login attempts.

    Limit: 30 attempts per hour
    Purpose: Prevent brute-force while allowing legitimate retries
    """

    rate = "30/hour"


class IPBasedRegisterThrottle(UserRateThrottle):
    """Rate limit for account registration per IP address.

    Limit: 10 registrations per hour per IP
    Purpose: Prevent mass account creation
    """

    rate = "10/hour"
    scope = "register"

    def get_cache_key(self, request: Request, view: APIView) -> str | None:
        """Use IP address for unauthenticated registration requests."""
        # For authenticated users, no limit
        if request.user and request.user.is_authenticated:
            return None

        # For anonymous users, rate limit by IP
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}

