"""Per-account EC-LCG utilities for deterministic nonce generation."""

from __future__ import annotations

from dataclasses import dataclass
from secrets import randbelow
from typing import Final, Tuple

from Crypto.Util import number

STATE_BYTE_LENGTH: Final[int] = 32


@dataclass
class ECLCGState:
    """Represents the EC-LCG parameters and current state."""

    modulus: int
    multiplier: int
    increment: int
    value: int


def _int_to_bytes(value: int) -> bytes:
    return value.to_bytes(STATE_BYTE_LENGTH, "big")


def _bytes_to_int(raw: bytes | memoryview | bytearray) -> int:
    return int.from_bytes(bytes(raw), "big")


def generate_account_state() -> ECLCGState:
    """Create a fresh random EC-LCG state for an account."""
    modulus = number.getPrime(STATE_BYTE_LENGTH * 8)
    multiplier = randbelow(modulus - 1) + 1  # ensure non-zero
    increment = randbelow(modulus)
    value = randbelow(modulus)
    return ECLCGState(
        modulus=modulus,
        multiplier=multiplier,
        increment=increment,
        value=value,
    )


def advance_state(state: ECLCGState) -> Tuple[int, ECLCGState]:
    """Advance the EC-LCG and return (k, new_state)."""
    next_value = (state.multiplier * state.value + state.increment) % state.modulus
    return next_value, ECLCGState(
        modulus=state.modulus,
        multiplier=state.multiplier,
        increment=state.increment,
        value=next_value,
    )


def pack_state(state: ECLCGState) -> tuple[bytes, bytes, bytes, bytes]:
    """Encode state fields as fixed-length big-endian byte strings."""
    return (
        _int_to_bytes(state.modulus),
        _int_to_bytes(state.multiplier),
        _int_to_bytes(state.increment),
        _int_to_bytes(state.value),
    )


def unpack_state(
    modulus_bytes: bytes,
    multiplier_bytes: bytes,
    increment_bytes: bytes,
    value_bytes: bytes,
) -> ECLCGState:
    """Decode persisted byte strings into an EC-LCG state."""
    return ECLCGState(
        modulus=_bytes_to_int(modulus_bytes),
        multiplier=_bytes_to_int(multiplier_bytes),
        increment=_bytes_to_int(increment_bytes),
        value=_bytes_to_int(value_bytes),
    )


__all__ = [
    "ECLCGState",
    "advance_state",
    "generate_account_state",
    "pack_state",
    "unpack_state",
]

