"""Management command to clean up expired vault sessions."""

from __future__ import annotations

import re
from datetime import timedelta
from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone

from vault.models import VaultSession


class Command(BaseCommand):
    """Delete expired vault sessions from the database."""

    help = "Clean up expired vault sessions to prevent unbounded database growth"

    def add_arguments(self, parser: Any) -> None:
        """Add command-line arguments."""
        parser.add_argument(
            "--older-than",
            type=str,
            default=None,
            help=(
                "Delete sessions expired longer than this duration (e.g., '2h', '30m', '1d'). "
                "Provides an extra safety buffer beyond the configured session lifetime."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview which sessions would be deleted without actually deleting them.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        """Execute the cleanup command."""
        dry_run = options["dry_run"]
        older_than_str = options.get("older_than")

        # Calculate cutoff time
        cutoff_time = timezone.now()
        if older_than_str:
            try:
                buffer_delta = self._parse_duration(older_than_str)
                cutoff_time -= buffer_delta
                self.stdout.write(
                    f"Looking for sessions expired before {cutoff_time.isoformat()} "
                    f"(extra buffer: {older_than_str})"
                )
            except ValueError as exc:
                self.stderr.write(self.style.ERROR(f"Invalid duration format: {exc}"))
                return

        # Find expired sessions
        expired_sessions = VaultSession.objects.filter(expires_at__lt=cutoff_time)
        count = expired_sessions.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(f"Would delete {count} expired vault sessions (dry run)")
            )
            if count > 0:
                self.stdout.write("Sample sessions to be deleted:")
                for session in expired_sessions[:5]:
                    self.stdout.write(
                        f"  - Session ID {session.pk} (user: {session.user_id}, "
                        f"expired: {session.expires_at.isoformat()})"
                    )
                if count > 5:
                    self.stdout.write(f"  ... and {count - 5} more")
        else:
            # Actually delete the sessions
            expired_sessions.delete()
            self.stdout.write(
                self.style.SUCCESS(f"Deleted {count} expired vault sessions")
            )

    def _parse_duration(self, duration_str: str) -> timedelta:
        """Parse a human-readable duration string into a timedelta.
        
        Supported formats: '1h', '30m', '2d', '1w'
        
        Args:
            duration_str: Duration string (e.g., '2h', '30m')
            
        Returns:
            timedelta object
            
        Raises:
            ValueError: If the format is invalid
        """
        match = re.match(r"^(\d+)([smhdw])$", duration_str.lower())
        if not match:
            raise ValueError(
                f"Invalid duration format: {duration_str}. "
                "Expected format: <number><unit> (e.g., '2h', '30m', '1d')"
            )

        value = int(match.group(1))
        unit = match.group(2)

        unit_map = {
            "s": "seconds",
            "m": "minutes",
            "h": "hours",
            "d": "days",
            "w": "weeks",
        }

        return timedelta(**{unit_map[unit]: value})

