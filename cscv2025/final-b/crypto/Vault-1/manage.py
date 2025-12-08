"""Django admin utility entrypoint for the CTF backend.

This script ensures the `src/` directory is on `sys.path` and
delegates to Django's command-line utility.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> None:
    """Run administrative tasks via Django's management utility."""
    # Ensure `src/` is importable so `config.settings` can be resolved.
    project_root: Path = Path(__file__).parent
    src_dir: Path = project_root / "src"
    sys.path.insert(0, str(src_dir))

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except Exception as exc:  # pragma: no cover - startup-only
        raise RuntimeError("Django is not installed or failed to import.") from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":  # pragma: no cover - startup-only
    main()


