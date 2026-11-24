"""Creating the database, loading the sample data, and resetting to it (R4, R5)."""

from pathlib import Path

from sqlalchemy import Connection, delete, insert, select

from accountable import clock, db, settings
from accountable.sample_data import sample_rows
from accountable.tables import app_info, metadata

LOADED = "sample_data_loaded_at"


def prepare_database() -> None:
    """Creates what's missing. Loads the sample data unless an earlier start finished loading it."""
    db.create_tables()
    with db.write() as connection:
        finished = connection.execute(select(app_info.c.value).where(app_info.c.key == LOADED)).first()
        if not finished:
            _load(connection)


def reset() -> None:
    """Replaces everything with the sample data, or changes nothing if it fails."""
    db.create_tables()
    with db.write() as connection:
        _load(connection)


def _load(connection: Connection) -> None:
    for table in reversed(metadata.sorted_tables):
        connection.execute(delete(table))
    for name, rows in sample_rows(clock.today()).items():
        connection.execute(insert(metadata.tables[name]), rows)
    connection.execute(insert(app_info).values(key=LOADED, value=clock.now().isoformat()))


def save_copy() -> Path | None:
    """A dated copy of the database in backups/ beside it, or None if there's no database yet."""
    source = settings.database_path()
    if not source.exists():
        return None
    name = f"{source.stem}-{clock.now().astimezone():%Y-%m-%d-%H%M%S}"
    target = source.parent / "backups" / f"{name}.db"
    number = 2
    while target.exists():  # Never replace an earlier copy.
        target = target.with_name(f"{name}-{number}.db")
        number += 1
    db.copy(target)
    return target
