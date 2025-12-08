"""Seed privileged development accounts and vault secrets."""

from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from vault.models import VaultSecret
from vault.services import (
    ensure_server_key,
    get_attestation_public_key,
    _int_to_bytes as vault_int_to_bytes,
)


class Command(BaseCommand):
    """Management command to seed privileged accounts and vault secrets."""

    help = "Seed privileged accounts and vault secrets"

    def handle(self, *args: str, **options: str) -> None:
        """Execute seeding operations."""
        self._seed_users()
        self._seed_vault_secret()

    def _seed_users(self) -> None:
        """Seed privileged user accounts."""
        user_model = get_user_model()

        manager_pw = os.environ.get("CTF_SEED_MANAGER_PASSWORD", "manager-pass")
        # Managers
        for uname in ("manager1"):
            user, created = user_model.objects.get_or_create(
                username=uname,
                defaults={"role": "MANAGER"},
            )
            if created:
                user.set_password(manager_pw)
                user.role = "MANAGER"
                user.save(update_fields=["password", "role"])
                self.stdout.write(f"Created user: {uname}")
            else:
                self.stdout.write(f"User exists: {uname}")
            if hasattr(user, "ensure_random_state"):
                user.ensure_random_state(save=True)

    def _seed_vault_secret(self) -> None:
        """Ensure demonstration vault secrets exist with proper keys."""
        demo_secret = os.environ.get("CTF_SEED_BOB_SECRET", "Demo vault secret").encode("utf-8")
        _server_scalar, server_public = ensure_server_key()
        VaultSecret.objects.update_or_create(
            owner="Bob",
            secret_id="primary",
            defaults={
                "public_x": vault_int_to_bytes(server_public.x),
                "public_y": vault_int_to_bytes(server_public.y),
                "plaintext": demo_secret,
            },
        )
        self.stdout.write("Ensured Bob vault secret exists (secret_id=primary)")

        escrow_secret = os.environ.get(
            "CTF_SEED_MANAGER_ESCROW_SECRET", "Manager escrow secret"
        ).encode("utf-8")
        attestation_public = get_attestation_public_key()
        VaultSecret.objects.update_or_create(
            owner="ManagerEscrow",
            secret_id="flag1",
            defaults={
                "public_x": vault_int_to_bytes(attestation_public.x),
                "public_y": vault_int_to_bytes(attestation_public.y),
                "plaintext": escrow_secret,
            },
        )
        self.stdout.write("Ensured ManagerEscrow vault secret exists (secret_id=flag1)")
