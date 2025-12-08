"""Service helpers for vault session establishment and secret handling."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Iterable, Tuple, Any, cast

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from crypto.ec_lcg import advance_state
from crypto.ecc_p192 import Curve, Point, hash_point, public_key_from_scalar
from crypto.ecdsa_p192 import sign_digest
from crypto.manager_key import derive_attestation_scalar
from vault.models import VaultSecret, VaultServerKey, VaultSession

_CURVE = Curve()
_POINT_BYTE_LENGTH = 24
User = get_user_model()


class SecretAlreadyExistsError(ValueError):
    """Raised when attempting to overwrite an existing vault secret."""


class SessionExpiredError(ValueError):
    """Raised when attempting to use an expired vault session."""


def _session_limit() -> int:
    return int(settings.SIGN_CONFIG.get("session_limit", 0))


@dataclass
class HandshakeResult:
    """Bundled server response for a vault session handshake."""

    server_public: Point
    session_public: Point
    session: VaultSession


def _int_to_bytes(value: int) -> bytes:
    return value.to_bytes(_POINT_BYTE_LENGTH, "big")


def _field_to_bytes(value: Any) -> bytes:
    data = value
    if isinstance(data, memoryview):
        return data.tobytes()
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    return bytes(data)


def _bytes_to_int(raw: Any) -> int:
    return int.from_bytes(_field_to_bytes(raw), "big")


def _bytes_to_point(x_bytes: Any, y_bytes: Any) -> Point:
    return Point(_CURVE, _bytes_to_int(x_bytes), _bytes_to_int(y_bytes))


def serialize_point(point: Point) -> dict[str, str]:
    return {
        "x": f"{point.x:048x}",
        "y": f"{point.y:048x}",
    }


def deserialize_point(data: dict[str, str]) -> Point:
    """Deserialize a point from hex coordinates.
    
    Special handling: (0, 0) is treated as the identity point.
    """
    x = int(data["x"], 16)
    y = int(data["y"], 16)
    if x == 0 and y == 0:
        return _CURVE.O  # Identity point
    return Point(_CURVE, x, y)


def _derive_server_scalar() -> int:
    secret = getattr(settings, "VAULT_SERVER_SECRET_KEY", None)
    if isinstance(secret, str) and secret.strip():
        material = secret.encode("utf-8")
        candidate = int.from_bytes(hashlib.sha512(material).digest(), "big")
        scalar = candidate % _CURVE.n
        return scalar or 1
    return secrets.randbelow(_CURVE.n - 1) + 1


def ensure_server_key() -> Tuple[int, Point]:
    """Return the server's long-term scalar and public point."""
    key = VaultServerKey.objects.first()
    if key is None:
        scalar = _derive_server_scalar()
        public = public_key_from_scalar(scalar)
        key = VaultServerKey.objects.create(
            scalar=_int_to_bytes(scalar),
            public_x=_int_to_bytes(public.x),
            public_y=_int_to_bytes(public.y),
        )
    scalar = _bytes_to_int(key.scalar)
    public = _bytes_to_point(key.public_x, key.public_y)
    return scalar, public


def _random_scalar() -> int:
    return secrets.randbelow(_CURVE.n - 1) + 1


def _derive_aes_key(shared_point: Point) -> bytes:
    material = hash_point(shared_point).to_bytes(_POINT_BYTE_LENGTH, "big")
    return hashlib.sha512(material).digest()[:16]


def _compute_shared_point(
    server_scalar: int,
    session_scalar: int,
    client_pub: Point,
    client_ephemeral: Point,
    session_public: Point,
) -> Point:
    hash_y = hash_point(session_public)
    hash_x = hash_point(client_ephemeral)
    # No modular reduction - let point multiplication handle it based on actual point order
    lhs_scalar = session_scalar + hash_y * server_scalar
    rhs_point = client_ephemeral + (client_pub * hash_x)
    return rhs_point * lhs_scalar


def create_session(user, client_pub: Point, client_ephemeral: Point) -> HandshakeResult:
    """Create a new vault session for the user (allows multiple concurrent sessions)."""
    server_scalar, server_public = ensure_server_key()
    session_scalar = _random_scalar()
    session_public = _CURVE.G * session_scalar
    shared_point = _compute_shared_point(
        server_scalar,
        session_scalar,
        client_pub,
        client_ephemeral,
        session_public,
    )
    aes_key = _derive_aes_key(shared_point)

    # Compute session expiration time
    now = timezone.now()
    lifetime_seconds = getattr(settings, "VAULT_SESSION_LIFETIME", 3600)
    expires_at = now + timedelta(seconds=lifetime_seconds)

    limit = _session_limit()
    session = VaultSession.objects.create(
        user=user,
        client_pub_x=_int_to_bytes(client_pub.x),
        client_pub_y=_int_to_bytes(client_pub.y),
        session_scalar=_int_to_bytes(session_scalar),
        session_pub_x=_int_to_bytes(session_public.x),
        session_pub_y=_int_to_bytes(session_public.y),
        aes_key=aes_key,
        signature_budget=limit if limit > 0 else 0,
        expires_at=expires_at,
    )

    return HandshakeResult(server_public=server_public, session_public=session_public, session=session)


def get_latest_session(user) -> VaultSession | None:
    """Retrieve the most recent vault session for a user."""
    return VaultSession.objects.filter(user=user).order_by('-created_at').first()


def validate_session(session: VaultSession) -> None:
    """Validate that a session is not expired.
    
    Raises:
        SessionExpiredError: If the session has expired.
    """
    if session.expires_at < timezone.now():
        raise SessionExpiredError("Vault session has expired. Create a new session to continue.")


def _get_aes(session: VaultSession) -> AES:
    return AES.new(_field_to_bytes(session.aes_key), AES.MODE_ECB)  # type: ignore[reportUnknownReturnType]


def decrypt_secret(session: VaultSession, ciphertext_hex: str) -> bytes:
    cipher = _get_aes(session)
    ciphertext = bytes.fromhex(ciphertext_hex)
    return unpad(cipher.decrypt(ciphertext), AES.block_size)


def encrypt_secret(session: VaultSession, plaintext: bytes) -> str:
    cipher = _get_aes(session)
    ciphertext = cipher.encrypt(pad(plaintext, AES.block_size))
    return ciphertext.hex()


def _compute_challenge(point: Point, T_point: Point, context: Iterable[bytes] = ()) -> int:
    material = _int_to_bytes(point.x) + _int_to_bytes(point.y)
    material += _int_to_bytes(T_point.x) + _int_to_bytes(T_point.y)
    for chunk in context:
        material += chunk
    digest = hashlib.sha256(material).digest()
    challenge = int.from_bytes(digest, "big") % _CURVE.n
    return challenge or 1


def validate_schnorr_proof(
    public_point: Point, T_point: Point, s: int, *, context: Iterable[bytes] = ()
) -> bool:
    challenge = _compute_challenge(public_point, T_point, context)
    lhs = _CURVE.G * s
    rhs = T_point + (public_point * challenge)
    return lhs == rhs


def generate_secret_id() -> str:
    """Generate a unique secret identifier using secure random token."""
    return secrets.token_hex(16)


def get_secrets_by_owner(owner: str) -> list[VaultSecret]:
    """Retrieve all secrets for a given owner."""
    return list(VaultSecret.objects.filter(owner=owner))


def store_secret(
    session: VaultSession,
    owner: str,
    owner_public: Point | None,
    ciphertext_hex: str,
    proof: Tuple[Point, int] | None,
    secret_id: str | None = None,
) -> str:
    """Store a secret and return the generated or provided secret_id."""
    if secret_id is None:
        secret_id = generate_secret_id()

    try:
        secret = VaultSecret.objects.get(owner=owner, secret_id=secret_id)
        raise SecretAlreadyExistsError(
            f"Secret already exists for owner '{owner}' with secret_id '{secret_id}'"
        )
    except VaultSecret.DoesNotExist:
        pass

    if owner_public is None:
        raise ValueError("Public key required for new owner")

    plaintext = decrypt_secret(session, ciphertext_hex)
    new_secret = VaultSecret(
        owner=owner,
        secret_id=secret_id,
        plaintext=plaintext,
    )
    if owner == "Bob":
        _, server_public = ensure_server_key()
        new_secret.public_x = _int_to_bytes(server_public.x)
        new_secret.public_y = _int_to_bytes(server_public.y)
    else:
        new_secret.public_x = _int_to_bytes(owner_public.x)
        new_secret.public_y = _int_to_bytes(owner_public.y)
    new_secret.save()
    return secret_id


def retrieve_secret(
    session: VaultSession, owner: str, secret_id: str, proof: Tuple[Point, int]
) -> str:
    """Retrieve a specific secret by owner and secret_id."""
    secret = VaultSecret.objects.get(owner=owner, secret_id=secret_id)
    public_point = _bytes_to_point(secret.public_x, secret.public_y)
    T_point, s_value = proof
    if not validate_schnorr_proof(public_point, T_point, s_value, context=[owner.encode("utf-8")]):
        raise ValueError("Invalid Schnorr proof")
    return encrypt_secret(session, bytes(secret.plaintext))


def sign_secret(session: VaultSession, secret_id: str, plaintext: bytes) -> Tuple[int, int]:
    """Sign the digest of a secret's plaintext."""
    digest = hashlib.sha512(_field_to_bytes(plaintext)).digest()
    return _sign_digest_with_session(session, digest)


def _sign_digest_with_session(session: VaultSession, digest: bytes) -> Tuple[int, int]:
    limit = _session_limit()
    current_budget: int | None = None
    if limit > 0:
        current_budget = cast(int, session.signature_budget)
        if current_budget <= 0:
            raise ValueError("Signature budget exhausted")

    # Mirror chall.py: sha512(secret) digests signed with secp192r1 and EC-LCG-backed nonces.
    scalar = _bytes_to_int(session.session_scalar)
    nonce = _consume_nonce_for_user(session.user)
    r, s = sign_digest(scalar, nonce, digest)
    if limit > 0 and current_budget is not None:
        session.signature_budget = current_budget - 1
        session.save(update_fields=["signature_budget", "updated_at"])
    return r, s


def _consume_nonce_for_user(user: Any) -> int:
    """Advance and persist the EC-LCG nonce for the associated account."""
    with transaction.atomic():
        locked = User.objects.select_for_update().get(pk=user.pk)
        if hasattr(locked, "ensure_random_state"):
            locked.ensure_random_state(save=True)
        state = locked.get_random_state()
        nonce, updated_state = advance_state(state)
        locked.set_random_state(updated_state)
        locked.save(update_fields=list(locked._RANDOM_STATE_FIELDS))
    return nonce


def get_attestation_public_key() -> Point:
    """Return the public key associated with the attestation scalar."""
    return public_key_from_scalar(derive_attestation_scalar())


def attest_secret(session: VaultSession, owner: str) -> tuple[str, tuple[Point, int]]:
    """Create a Schnorr attestation receipt for the given secret."""
    secret = VaultSecret.objects.get(owner=owner)
    plaintext = _field_to_bytes(secret.plaintext)
    hash_bytes = hashlib.sha256(plaintext).digest()
    nonce = _consume_nonce_for_user(session.user) % _CURVE.n
    if nonce == 0:
        nonce = 1
    R_point = _CURVE.G * nonce
    attestation_scalar = derive_attestation_scalar()
    attestation_public = public_key_from_scalar(attestation_scalar)
    challenge = _compute_challenge(
        attestation_public,
        R_point,
        context=[hash_bytes, owner.encode("utf-8")],
    )
    response = (nonce + challenge * attestation_scalar) % _CURVE.n
    return hash_bytes.hex(), (R_point, response)
