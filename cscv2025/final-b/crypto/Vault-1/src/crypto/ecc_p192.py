"""Minimal secp192r1 elliptic curve primitives.

This module implements point addition, subtraction, and scalar multiplication
for ECDSA-style signing operations on the secp192r1 curve.
"""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha512

P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFFFFFFFFFF
A = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFFFFFFFFFC
B = 0x64210519E59C80E70FA7E9AB72243049FEB8DEECC146B9B1
N = 0xFFFFFFFFFFFFFFFFFFFFFFFF99DEF836146BC9B1B4D22831
GX = 0x188DA80EB03090F67CBF20EB43A18800F4FF0AFD82FF1012
GY = 0x07192B95FFC8DA78631011ED6B24CDD573F977A11E794811


def _mod_inv(value: int, modulus: int) -> int:
    """Compute multiplicative inverse modulo ``modulus``."""
    return pow(value % modulus, -1, modulus)


@dataclass(frozen=True)
class Curve:
    """Parameters and identity element for secp192r1."""

    p: int = P
    a: int = A
    b: int = B
    n: int = N
    gx: int = GX
    gy: int = GY

    def __post_init__(self) -> None:
        object.__setattr__(self, "O", Point(self, 0, 0, infinity=True))
        object.__setattr__(self, "G", Point(self, self.gx, self.gy))


class Point:
    """Affine point on secp192r1."""

    __slots__ = ("curve", "x", "y", "infinity")

    def __init__(self, curve: Curve, x: int, y: int, *, infinity: bool = False) -> None:
        self.curve = curve
        self.infinity = infinity
        if infinity:
            self.x = 0
            self.y = 0
        else:
            self.x = x % curve.p
            self.y = y % curve.p

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return "Point(infinity=True)" if self.infinity else f"Point(x={self.x}, y={self.y})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Point):
            return NotImplemented
        if self.infinity and other.infinity:
            return True
        return (self.infinity == other.infinity) and self.x == other.x and self.y == other.y

    def __neg__(self) -> "Point":
        if self.infinity:
            return self
        return Point(self.curve, self.x, (-self.y) % self.curve.p)

    def __add__(self, other: "Point") -> "Point":
        if self.infinity:
            return other
        if other.infinity:
            return self

        curve = self.curve

        if self.x == other.x and (self.y + other.y) % curve.p == 0:
            return curve.O

        if self == other:
            m = (3 * self.x * self.x + curve.a) * _mod_inv(2 * self.y, curve.p)
        else:
            m = (other.y - self.y) * _mod_inv(other.x - self.x, curve.p)

        m %= curve.p
        x_r = (m * m - self.x - other.x) % curve.p
        y_r = (m * (self.x - x_r) - self.y) % curve.p
        return Point(curve, x_r, y_r)

    def __sub__(self, other: "Point") -> "Point":
        return self + (-other)

    def __mul__(self, scalar: int) -> "Point":
        return self._scalar_mul(scalar)

    __rmul__ = __mul__

    def _scalar_mul(self, scalar: int) -> "Point":
        if self.infinity or scalar == 0:
            return self.curve.O
        if scalar < 0:
            return (-self)._scalar_mul(-scalar)

        result = self.curve.O
        addend = self
        k = scalar

        while k:
            if k & 1:
                result = result + addend
            addend = addend + addend
            k >>= 1
        return result

    def is_infinity(self) -> bool:
        return self.infinity


def public_key_from_scalar(private_scalar: int) -> Point:
    """Derive the public key point from a private scalar."""
    curve = Curve()
    scalar = private_scalar % curve.n
    if scalar == 0:
        raise ValueError("Invalid private scalar")
    return curve.G * scalar


def hash_point(point: Point) -> int:
    """Hash an affine point to an integer modulo curve order."""
    curve = Curve()
    x_bytes = point.x.to_bytes(24, "big")
    y_bytes = point.y.to_bytes(24, "big")
    digest = sha512(x_bytes + y_bytes).digest()
    return int.from_bytes(digest, "big") % curve.n


__all__ = [
    "Curve",
    "Point",
    "public_key_from_scalar",
    "hash_point",
    "P",
    "A",
    "B",
    "N",
    "GX",
    "GY",
]
