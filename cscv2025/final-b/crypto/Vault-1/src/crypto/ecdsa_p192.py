"""ECDSA helpers over secp192r1 with controllable nonces."""

from __future__ import annotations

from typing import Tuple

from .ecc_p192 import Curve, Point, public_key_from_scalar


def _normalize_scalar(value: int, modulus: int) -> int:
    scalar = value % modulus
    if scalar == 0:
        scalar = 1
    return scalar


def sign_digest(private_scalar: int, nonce: int, digest: bytes) -> Tuple[int, int]:
    """Sign a message digest using ECDSA over secp192r1.

    Args:
        private_scalar: Secret scalar ``d``.
        nonce: Ephemeral nonce ``k`` (caller controls via EC-LCG).
        digest: Hash digest of the message to sign.

    Returns:
        Tuple ``(r, s)`` forming the ECDSA signature.
    """
    curve = Curve()
    d = _normalize_scalar(private_scalar, curve.n)
    k = _normalize_scalar(nonce, curve.n)
    z = int.from_bytes(digest, "big") % curve.n

    while True:
        R = curve.G * k
        if R.is_infinity():
            k = (k + 1) % curve.n or 1
            continue
        r = R.x % curve.n
        if r == 0:
            k = (k + 1) % curve.n or 1
            continue
        k_inv = pow(k, -1, curve.n)
        s = (k_inv * (z + r * d)) % curve.n
        if s == 0:
            k = (k + 1) % curve.n or 1
            continue
        return r, s


def verify_signature(public_key: Point, r: int, s: int, digest: bytes) -> bool:
    """Verify an ECDSA signature using the curve primitives."""
    curve = Curve()
    if not (1 <= r < curve.n and 1 <= s < curve.n):
        return False
    z = int.from_bytes(digest, "big") % curve.n
    s_inv = pow(s, -1, curve.n)
    u1 = (z * s_inv) % curve.n
    u2 = (r * s_inv) % curve.n
    candidate = curve.G * u1 + public_key * u2
    if candidate.is_infinity():
        return False
    return (candidate.x % curve.n) == r


__all__ = ["sign_digest", "verify_signature", "public_key_from_scalar"]
