"""The database. The only file that knows it's SQLite."""

import sqlite3
from collections.abc import Iterator
from contextlib import closing, contextmanager
from functools import cache
from pathlib import Path
from threading import Lock

from sqlalchemy import URL, Connection, Engine, create_engine, delete, event, false

from accountable import settings
from accountable.tables import app_info, metadata

# How long to wait for another program, such as the reset command, to finish with the file.
WAIT_SECONDS = 30

# An id is never used again, so an old link or Undo can't reach a newer record. Postgres does this by itself.
for table in metadata.sorted_tables:
    table.dialect_options["sqlite"]["autoincrement"] = table is not app_info

_write_lock = Lock()


@cache
def _engine_for(path: Path) -> Engine:
    engine = create_engine(
        URL.create("sqlite", database=str(path)),
        # IMMEDIATE takes the file's write lock when a transaction starts, not halfway through it.
        connect_args={"timeout": WAIT_SECONDS, "isolation_level": "IMMEDIATE"},
    )

    @event.listens_for(engine, "connect")
    def turn_on_foreign_keys(connection: sqlite3.Connection, _record):
        connection.setconfig(sqlite3.SQLITE_DBCONFIG_ENABLE_FKEY, True)

    return engine


def engine() -> Engine:
    return _engine_for(settings.database_path())


@contextmanager
def read() -> Iterator[Connection]:
    with engine().connect() as connection:
        yield connection


@contextmanager
def write() -> Iterator[Connection]:
    """One transaction, kept whole or not at all. Only one runs at a time, so two changes can't mix."""
    with _write_lock, engine().begin() as connection:
        # Deletes nothing, but starts the transaction, so what's read from here on can't change under us.
        connection.execute(delete(app_info).where(false()))
        yield connection


def create_tables() -> None:
    settings.database_path().parent.mkdir(parents=True, exist_ok=True)
    with _write_lock:
        metadata.create_all(engine())


def copy(target: Path) -> None:
    """Copies the database to a new file. Safe while the app is using it."""
    target.parent.mkdir(parents=True, exist_ok=True)
    source = settings.database_path()
    with (
        closing(sqlite3.connect(source, timeout=WAIT_SECONDS)) as from_file,
        closing(sqlite3.connect(target)) as to_file,
    ):
        from_file.backup(to_file)
