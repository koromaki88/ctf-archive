"""URL routing for the vault service."""

from __future__ import annotations

from django.urls import path

from vault.views import (
    VaultAttestationKeyView,
    VaultAttestSecretView,
    VaultListSecretsView,
    VaultRetrieveSecretView,
    VaultSessionView,
    VaultStoreSecretView,
)

app_name = "vault"

urlpatterns = [
    path("session", VaultSessionView.as_view(), name="session"),
    path("secrets/store", VaultStoreSecretView.as_view(), name="secrets-store"),
    path("secrets/retrieve", VaultRetrieveSecretView.as_view(), name="secrets-retrieve"),
    path("secrets/signatures", VaultListSecretsView.as_view(), name="secrets-signatures"),
    path("secrets/<str:owner>/attest", VaultAttestSecretView.as_view(), name="secrets-attest"),
    path("attestation-key", VaultAttestationKeyView.as_view(), name="attestation-key"),
]
