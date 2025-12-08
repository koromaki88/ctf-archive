"""Database models supporting the vault handshake and storage."""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class VaultServerKey(models.Model):
    """Persist the server's long-term secret and public key."""

    scalar = models.BinaryField(max_length=24, editable=False)
    public_x = models.BinaryField(max_length=24, editable=False)
    public_y = models.BinaryField(max_length=24, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Vault Server Key"
        verbose_name_plural = "Vault Server Keys"

    def __str__(self) -> str:  # pragma: no cover - admin helper
        return "VaultServerKey"


class VaultSession(models.Model):
    """Track an authenticated vault session for a player."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vault_sessions",
    )
    client_pub_x = models.BinaryField(max_length=24)
    client_pub_y = models.BinaryField(max_length=24)
    session_scalar = models.BinaryField(max_length=24)
    session_pub_x = models.BinaryField(max_length=24)
    session_pub_y = models.BinaryField(max_length=24)
    aes_key = models.BinaryField(max_length=16)
    signature_budget = models.PositiveIntegerField(default=64)  # type: ignore[arg-type]
    expires_at = models.DateTimeField(db_index=True, default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Vault Session"
        verbose_name_plural = "Vault Sessions"

    def __str__(self) -> str:  # pragma: no cover - admin helper
        return f"VaultSession(user={self.user_id})"


class VaultSecret(models.Model):
    """Store secrets indexed by an owner identifier and secret_id."""

    owner = models.CharField(max_length=128, db_index=True)
    secret_id = models.CharField(max_length=64, db_index=True, default="default")
    public_x = models.BinaryField(max_length=24)
    public_y = models.BinaryField(max_length=24)
    plaintext = models.BinaryField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Vault Secret"
        verbose_name_plural = "Vault Secrets"
        unique_together = [["owner", "secret_id"]]

    def __str__(self) -> str:  # pragma: no cover - admin helper
        return f"VaultSecret(owner={self.owner}, secret_id={self.secret_id})"
