"""Custom user model with role support and per-account EC-LCG random state."""

from __future__ import annotations

from typing import Iterable, Sequence

from django.contrib.auth.models import AbstractUser
from django.db import models

from crypto.ec_lcg import ECLCGState, generate_account_state, pack_state, unpack_state


class User(AbstractUser):
    """User model extended with a role field.

    Username-only authentication is used per project decision.
    """

    class Role(models.TextChoices):
        STAFF = "STAFF", "STAFF"
        MANAGER = "MANAGER", "MANAGER"

    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STAFF)
    random_state_modulus = models.BinaryField(max_length=32, null=True, blank=True, editable=False)
    random_state_multiplier = models.BinaryField(max_length=32, null=True, blank=True, editable=False)
    random_state_increment = models.BinaryField(max_length=32, null=True, blank=True, editable=False)
    random_state_value = models.BinaryField(max_length=32, null=True, blank=True, editable=False)

    _RANDOM_STATE_FIELDS: Sequence[str] = (
        "random_state_modulus",
        "random_state_multiplier",
        "random_state_increment",
        "random_state_value",
    )

    def has_random_state(self) -> bool:
        """Return True when all random_state fields are populated."""
        return all(getattr(self, field) for field in self._RANDOM_STATE_FIELDS)

    def get_random_state(self) -> ECLCGState:
        """Return the current EC-LCG state, ensuring it exists."""
        if not self.has_random_state():
            raise RuntimeError("Random state is not initialised for this account")
        return unpack_state(
            self.random_state_modulus,  # type: ignore[arg-type]
            self.random_state_multiplier,  # type: ignore[arg-type]
            self.random_state_increment,  # type: ignore[arg-type]
            self.random_state_value,  # type: ignore[arg-type]
        )

    def set_random_state(self, state: ECLCGState) -> None:
        """Persist the provided EC-LCG state on the user instance."""
        modulus, multiplier, increment, value = pack_state(state)
        self.random_state_modulus = modulus
        self.random_state_multiplier = multiplier
        self.random_state_increment = increment
        self.random_state_value = value

    def ensure_random_state(self, *, save: bool = True, update_fields: Iterable[str] | None = None) -> None:
        """Create and persist a random state if missing."""
        if self.has_random_state():
            return
        self.set_random_state(generate_account_state())
        if save:
            fields = list(update_fields) if update_fields else list(self._RANDOM_STATE_FIELDS)
            self.save(update_fields=fields)
