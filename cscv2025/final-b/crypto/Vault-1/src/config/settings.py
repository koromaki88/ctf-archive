"""Django settings for the backend project.

This settings module configures DRF, SimpleJWT (HS256), logging, and
environment-driven configuration aligned with project conventions.
"""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from typing import Any

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR: Path = Path(__file__).resolve().parents[2]
SRC_DIR: Path = BASE_DIR / "src"


class DjangoConfig(BaseSettings):
    """Environment-backed configuration for Django runtime.

    All values default to sane development settings and can be overridden by
    environment variables or a `.env` file at project root.
    """

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"), env_prefix="CTF_", extra="ignore",
    )

    debug: bool = Field(default=True)
    secret_key: str = Field(default="ctf-dev-secret-key-1c4f68d6c1a34d68a4cdb262b2e7d5d9")
    # Accept comma-separated string to avoid JSON decoding pitfalls in .env
    allowed_hosts: str = Field(default="*")

    # Shared secret reused for HS256 JWT signing and secp192r1 scalar derivation
    manager_secret_key: str = Field(
        default="ctf-dev-manager-secret-key-6cb4cc9a52c24c02af6b1d8c94d1cf11"
    )

    # Database URL (default sqlite)
    database_url: str = Field(default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")

    # Redis URL for caching and sessions
    redis_url: str = Field(default="")

    # Cryptographic configuration
    tenant_salt: str = Field(default="ctf-dev-tenant-salt-2a470c1ad2ef4b6b")

    # Optional override for vault server scalar derivation
    vault_server_secret_key: str | None = Field(default=None)

    # Vault session lifetime in seconds (default: 1 hour)
    vault_session_lifetime: int = Field(default=3600)

    # Rate limiting toggle (emergency override)
    rate_limit_enabled: bool = Field(default=True)

settings_env = DjangoConfig()


MANAGER_SECRET_KEY: str = settings_env.manager_secret_key
VAULT_SERVER_SECRET_KEY: str | None = settings_env.vault_server_secret_key
VAULT_SESSION_LIFETIME: int = settings_env.vault_session_lifetime
DEBUG: bool = settings_env.debug
SECRET_KEY: str = settings_env.secret_key


_PLACEHOLDER_MARKERS = ("REPLACE_ME", "CHANGE_ME")
_KNOWN_DEV_VALUES = {
    "dev-secret-key",
    "dev-tenant-salt-change-in-production",
}


def _ensure_secret(
    value: str | None,
    *,
    name: str,
    allow_blank: bool = False,
    min_length: int | None = None,
) -> None:
    """Validate that critical secrets are not placeholders or trivially weak."""
    if value is None:
        if allow_blank:
            return
        raise ImproperlyConfigured(f"{name} must be set.")

    candidate = value.strip()
    if not candidate:
        if allow_blank:
            return
        raise ImproperlyConfigured(f"{name} must not be empty.")

    upper_candidate = candidate.upper()
    if any(marker in upper_candidate for marker in _PLACEHOLDER_MARKERS):
        raise ImproperlyConfigured(
            f"{name} contains a placeholder value. Replace it before running the service.",
        )

    if candidate in _KNOWN_DEV_VALUES:
        raise ImproperlyConfigured(
            f"{name} is using a known development secret. Provide a unique value instead.",
        )

    if min_length and len(candidate) < min_length:
        raise ImproperlyConfigured(f"{name} must be at least {min_length} characters long.")


_ensure_secret(settings_env.tenant_salt, name="CTF_TENANT_SALT", min_length=16)
_ensure_secret(MANAGER_SECRET_KEY, name="CTF_MANAGER_SECRET_KEY", min_length=32)
_ensure_secret(VAULT_SERVER_SECRET_KEY, name="CTF_VAULT_SERVER_SECRET_KEY", allow_blank=True, min_length=32)

# Validate vault session lifetime
if VAULT_SESSION_LIFETIME < 60:
    raise ImproperlyConfigured("CTF_VAULT_SESSION_LIFETIME must be at least 60 seconds.")


def _parse_allowed_hosts(raw: str) -> list[str]:
    """Parse a comma-separated string into Django's ALLOWED_HOSTS list."""
    value = raw.strip()
    if value == "*" or value == "":
        return ["*"] if value == "*" else []
    return [h.strip() for h in value.split(",") if h.strip()]


ALLOWED_HOSTS: list[str] = _parse_allowed_hosts(settings_env.allowed_hosts)

INSTALLED_APPS: list[str] = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework.authtoken",
    # Local apps
    "health",
    "accounts",
    "crypto",
    "vault",
    "shared",
]

MIDDLEWARE: list[str] = [
    "django.middleware.security.SecurityMiddleware",
    # Attach request ID early so downstream layers can log it
    "shared.middleware.RequestIdMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "accounts.middleware.JWTHeaderAuthenticationMiddleware",
    "vault.middleware.VaultSessionMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Add rate limit headers to responses (temporarily disabled for debugging)
    # "shared.middleware.RateLimitHeaderMiddleware",
]

ROOT_URLCONF: str = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION: str = "config.wsgi.application"
ASGI_APPLICATION: str = "config.asgi.application"

# Database configuration with connection pooling for production
DATABASES: dict[str, dict[str, Any]] = {
    "default": dj_database_url.config(
        default=settings_env.database_url,
        conn_max_age=600,  # Connection pooling: keep connections alive for 10 minutes
        conn_health_checks=True,  # Enable connection health checks
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Cache configuration: Redis for production, in-memory for local dev
# Only use Redis in Docker production environment (redis://redis:)
# Local dev uses in-memory cache (even if redis://localhost is specified, to avoid requiring Redis locally)
_use_redis = settings_env.redis_url.startswith("redis://redis:")

if _use_redis:
    # Production: Redis cache with cache-based sessions
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": settings_env.redis_url,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "CONNECTION_POOL_KWARGS": {"max_connections": 50},
                "SOCKET_CONNECT_TIMEOUT": 5,
                "SOCKET_TIMEOUT": 5,
            },
        }
    }
    SESSION_ENGINE = "django.contrib.sessions.backends.cache"
    SESSION_CACHE_ALIAS = "default"
else:
    # Local dev: In-memory cache with database sessions (no Redis required)
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "unique-snowflake",
        }
    }
    SESSION_ENGINE = "django.contrib.sessions.backends.db"


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    # Pagination
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    # Rate limiting (CTF-friendly with generous limits)
    "DEFAULT_THROTTLE_CLASSES": (
        [] if not settings_env.rate_limit_enabled else [
            "rest_framework.throttling.UserRateThrottle",
        ]
    ),
    "DEFAULT_THROTTLE_RATES": {
        "user": "1000/hour",  # Baseline: ~16 req/sec for general API access
        "session": "200/hour",  # Vault session creation
        "store": "100/hour",  # Secret storage
        "retrieve": "300/hour",  # Secret retrieval
        "signatures": "300/hour",  # Signature collection
        "attest": "200/hour",  # Attestation requests
        "auth": "30/hour",  # Authentication attempts
        "register": "10/hour",  # Account registration per IP
    },
}


SIMPLE_JWT = {
    "ALGORITHM": "HS256",
    "SIGNING_KEY": MANAGER_SECRET_KEY,
    "VERIFYING_KEY": None,
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=8),
}


# Use custom user model from accounts
AUTH_USER_MODEL: str = "accounts.User"


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "shared.logging.JsonFormatter",
        },
    },
    "filters": {
        "request_id": {
            "()": "shared.logging.RequestIdFilter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["request_id"],
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}


# Cryptographic configuration for capability PBAC and vault
CRYPTO_CONFIG: dict[str, Any] = {
    "tenant_salt": settings_env.tenant_salt,
    "manager_secret_key": MANAGER_SECRET_KEY,
}

SIGN_CONFIG: dict[str, Any] = {
    # session_limit <= 0 disables per-session throttling (default: unlimited)
    "session_limit": 0,
}

# CTF system-wide limits (prevent database explosion)
CTF_LIMITS: dict[str, Any] = {
    # Per-user maximums (lifetime limits)
    "max_secrets_per_user": 500,  # Reference exploit uses ~20
    "max_active_sessions_per_user": 100,  # Reference exploit uses ~48
    # Global maximums
    "max_total_secrets": 100000,  # 500 per user × 200 users
    "max_total_sessions": 20000,  # 100 per user × 200 users
    # Session management
    "session_expire_after": 3600,  # 1 hour (CTF lasts 8 hours)
    "cleanup_interval": 1800,  # Clean expired sessions every 30 minutes
}
