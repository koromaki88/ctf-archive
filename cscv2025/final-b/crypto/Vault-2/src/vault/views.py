"""REST views for vault session management and secret APIs."""

from __future__ import annotations

import hashlib
from typing import Any, cast

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.throttles import (
    AttestationThrottle,
    SignatureCollectionThrottle,
    VaultRetrieveThrottle,
    VaultSessionThrottle,
    VaultStoreThrottle,
)
from vault.models import VaultSession, VaultSecret
from vault.services import (
    HandshakeResult,
    SecretAlreadyExistsError,
    SessionExpiredError,
    attest_secret,
    create_session,
    deserialize_point,
    get_attestation_public_key,
    get_latest_session,
    serialize_point,
    sign_secret,
    store_secret,
    retrieve_secret,
    validate_session,
)

def _require_manager(request: Request) -> bool:
    return getattr(request.user, "role", None) == "MANAGER"


def _session_or_403(request: Request) -> VaultSession | Response:
    """Retrieve session by header - session ID is required to prevent session conflicts."""
    session_id_header = request.headers.get("X-Vault-Session-ID")
    
    if not session_id_header:
        return Response(
            {"detail": "X-Vault-Session-ID header is required"},
            status=status.HTTP_428_PRECONDITION_REQUIRED,
        )
    
    # Explicit session selection via header
    try:
        session_id = int(session_id_header)
        session = VaultSession.objects.filter(pk=session_id, user=request.user).first()
        if session is None:
            return Response(
                {"detail": "Session not found or expired"},
                status=status.HTTP_428_PRECONDITION_REQUIRED,
            )
        
        # Validate session is not expired
        try:
            validate_session(session)
        except SessionExpiredError as exc:
            return Response(
                {"error": "Session expired", "detail": str(exc)},
                status=status.HTTP_428_PRECONDITION_REQUIRED,
            )
        
        return session
    except ValueError:
        return Response(
            {"detail": "Session not found or expired"},
            status=status.HTTP_428_PRECONDITION_REQUIRED,
        )


class VaultSessionView(APIView):
    """Establish a new HMQV-like session."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [VaultSessionThrottle]  # 200/hour

    def post(self, request: Request) -> Response:
        payload = cast(dict[str, Any], request.data)
        try:
            client_pub = deserialize_point(cast(dict[str, str], payload["static_pub"]))
            client_ephemeral = deserialize_point(cast(dict[str, str], payload["ephemeral_pub"]))
        except (KeyError, ValueError) as exc:
            return Response(
                {"detail": f"Invalid handshake payload: {exc}"}, status=status.HTTP_400_BAD_REQUEST
            )

        result = create_session(request.user, client_pub, client_ephemeral)
        return Response(_serialize_handshake(result), status=status.HTTP_200_OK)


class VaultStoreSecretView(APIView):
    """Store or update a secret for an owner."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [VaultStoreThrottle]  # 100/hour

    def post(self, request: Request) -> Response:
        session = _session_or_403(request)
        if isinstance(session, Response):
            return session

        payload = cast(dict[str, Any], request.data)
        owner = payload.get("owner")
        ciphertext = payload.get("ciphertext_hex")
        secret_id = payload.get("secret_id")  # Optional
        
        if (
            not owner
            or not isinstance(owner, str)
            or not ciphertext
            or not isinstance(ciphertext, str)
        ):
            return Response(
                {"detail": "owner and ciphertext_hex are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if secret_id is not None and not isinstance(secret_id, str):
            return Response(
                {"detail": "secret_id must be a string"}, status=status.HTTP_400_BAD_REQUEST
            )

        public_data = payload.get("public_key")
        owner_public = deserialize_point(cast(dict[str, str], public_data)) if public_data else None

        proof_payload = payload.get("proof")
        proof_tuple = None
        if proof_payload:
            try:
                proof_data = cast(dict[str, Any], proof_payload)
                T_point = deserialize_point(cast(dict[str, str], proof_data["T"]))
                s_value = int(cast(str, proof_data["s"]), 16)
                proof_tuple = (T_point, s_value)
            except (KeyError, ValueError) as exc:
                return Response(
                    {"detail": f"Invalid Schnorr proof: {exc}"}, status=status.HTTP_400_BAD_REQUEST
                )

        try:
            generated_secret_id = store_secret(session, owner, owner_public, ciphertext, proof_tuple, secret_id)
        except SecretAlreadyExistsError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"secret_id": generated_secret_id, "message": "Secret stored"}, status=status.HTTP_200_OK
        )


class VaultRetrieveSecretView(APIView):
    """Retrieve an encrypted secret after successful Schnorr authentication."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [VaultRetrieveThrottle]  # 300/hour

    def post(self, request: Request) -> Response:
        session = _session_or_403(request)
        if isinstance(session, Response):
            return session

        payload = cast(dict[str, Any], request.data)
        owner = payload.get("owner")
        secret_id = payload.get("secret_id")
        proof_payload = payload.get("proof")
        
        if not owner or not isinstance(owner, str):
            return Response({"detail": "owner is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not secret_id or not isinstance(secret_id, str):
            return Response({"detail": "secret_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not proof_payload:
            return Response({"detail": "proof is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            proof_data = cast(dict[str, Any], proof_payload)
            T_point = deserialize_point(cast(dict[str, str], proof_data["T"]))
            s_value = int(cast(str, proof_data["s"]), 16)
        except (KeyError, ValueError) as exc:
            return Response(
                {"detail": f"Invalid Schnorr proof: {exc}"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ciphertext_hex = retrieve_secret(session, owner, secret_id, (T_point, s_value))
        except VaultSecret.DoesNotExist:  # type: ignore[name-defined]
            return Response({"detail": "Secret not found"}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"ciphertext_hex": ciphertext_hex}, status=status.HTTP_200_OK)


class VaultListSecretsView(APIView):
    """List all stored secrets for a given owner plus EC-LCG-backed signatures."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [SignatureCollectionThrottle]  # 300/hour

    def get(self, request: Request) -> Response:
        session = _session_or_403(request)
        if isinstance(session, Response):
            return session

        owner = request.query_params.get("owner")
        if not owner:
            return Response(
                {"detail": "owner query parameter is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        secrets = list(VaultSecret.objects.filter(owner=owner).order_by("secret_id"))
        session_limit = int(settings.SIGN_CONFIG.get("session_limit", 0))
        required_budget = len(secrets)
        if session_limit > 0:
            session_budget = cast(int, session.signature_budget)
            if required_budget > session_budget:
                return Response(
                    {"detail": "Session signature budget exhausted"},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        payload: list[dict[str, str]] = []
        for secret in secrets:
            plaintext = bytes(secret.plaintext)
            digest = hashlib.sha512(plaintext).digest()
            r, s = sign_secret(session, secret.secret_id, plaintext)
            payload.append(
                {
                    "secret_id": secret.secret_id,
                    "r": f"{r:048x}",
                    "s": f"{s:048x}",
                    "digest_hex": digest.hex(),
                },
            )

        response = Response(payload, status=status.HTTP_200_OK)
        response["X-Sign-Source"] = "session"
        response["X-Sign-Curve"] = "secp192r1"
        if session_limit > 0:
            session.refresh_from_db(fields=["signature_budget"])
            updated_budget = cast(int, session.signature_budget)
            response["X-Sign-Session-Remaining"] = str(updated_budget)
        else:
            response["X-Sign-Session-Remaining"] = "unlimited"
        return response


class VaultAttestSecretView(APIView):
    """Issue Schnorr attestation receipts for stored secrets."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [AttestationThrottle]  # 200/hour

    def post(self, request: Request, owner: str) -> Response:
        session = _session_or_403(request)
        if isinstance(session, Response):
            return session

        try:
            hash_hex, (R_point, s_value) = attest_secret(session, owner)
        except VaultSecret.DoesNotExist:
            return Response({"detail": "Secret not found"}, status=status.HTTP_404_NOT_FOUND)

        response = Response(
            {
                "owner": owner,
                "hash_hex": hash_hex,
                "attestation": {
                    "R_x": f"{R_point.x:048x}",
                    "R_y": f"{R_point.y:048x}",
                    "s": f"{s_value:048x}",
                },
            },
            status=status.HTTP_200_OK,
        )
        response["X-Attest-Curve"] = "secp192r1"
        response["X-Attest-Source"] = "ec-lcg"
        return response


class VaultAttestationKeyView(APIView):
    """Expose the public verification key for document attestations."""

    permission_classes = [AllowAny]
    authentication_classes: list[type] = []

    def get(self, request: Request) -> Response:
        public_key = get_attestation_public_key()
        payload = {
            "public_key": serialize_point(public_key),
            "curve": "secp192r1",
            "purpose": "Document attestation receipt verification",
        }
        return Response(payload, status=status.HTTP_200_OK)


def _serialize_handshake(result: HandshakeResult) -> dict[str, Any]:
    return {
        "server_pub": serialize_point(result.server_public),
        "session_pub": serialize_point(result.session_public),
        "session_id": result.session.pk,
        "expires_at": result.session.expires_at.isoformat(),
    }
