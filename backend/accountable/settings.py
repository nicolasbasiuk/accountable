"""Settings from the environment. Tests use them; nobody else needs to."""

import os
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def database_path() -> Path:
    return Path(os.environ.get("ACCOUNTABLE_DB") or ROOT / "data" / "accountable.db")


def fixed_today() -> date | None:
    text = os.environ.get("ACCOUNTABLE_TODAY")
    return date.fromisoformat(text) if text else None
