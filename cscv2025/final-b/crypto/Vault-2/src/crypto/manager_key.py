"""Utilities for deriving manager signing material from shared secret.

The secp192r1 private scalar and HS256 signing key both originate from the
same tenant-specific secret. This module provides helpers to expose consistent
byte material and convert it into a curve scalar.
"""

from __future__ import annotations

import hashlib
from typing import Final

from django.conf import settings

# secp192r1 group order
_SECP192R1_ORDER: Final[int] = 0xFFFFFFFFFFFFFFFFFFFFFFFF99DEF836146BC9B1B4D22831


def get_manager_secret_bytes() -> bytes:
    """Return the raw manager secret key material as bytes."""
    secret = getattr(settings, "MANAGER_SECRET_KEY", None)
    if not isinstance(secret, str):
        raise RuntimeError("MANAGER_SECRET_KEY is not configured")
    return secret.encode("utf-8")


def derive_manager_scalar() -> int:
    """Derive the secp192r1 private scalar ``d`` from the manager secret.

    The derivation hashes the UTF-8 secret with SHA-512 and reduces it modulo
    the curve order to guarantee a valid scalar within ``[1, n-1]``.
    """
    digest = hashlib.sha512(get_manager_secret_bytes()).digest()
    candidate = int.from_bytes(digest, "big") % _SECP192R1_ORDER
    return candidate


def get_manager_private_scalar() -> int:
    """Backward-compatible alias for :func:`derive_manager_scalar`."""
    return derive_manager_scalar()


__all__ = ["derive_manager_scalar", "get_manager_secret_bytes", "get_manager_private_scalar"]


def derive_attestation_scalar() -> int:
    """Derive the secp192r1 attestation scalar from ``MANAGER_SECRET_KEY``."""
    return derive_manager_scalar()


__all__ += ["derive_attestation_scalar"]
