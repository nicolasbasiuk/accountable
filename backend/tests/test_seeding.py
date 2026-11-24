import sqlite3
import threading
from contextlib import closing

import pytest
from sqlalchemy import delete, func, insert, select

from accountable import db, seeding
from accountable.sample_data import sample_rows
from accountable.tables import app_info, contacts, deals, metadata, organizations

TABLES = [table for table in metadata.sorted_tables if table is not app_info]


def counts() -> dict[str, int]:
    with db.read() as connection:
        return {table.name: connection.scalar(select(func.count()).select_from(table)) for table in TABLES}


def names(table=organizations) -> list[str]:
    with db.read() as connection:
        return list(connection.scalars(select(table.c.name).order_by(table.c.id)))


def add_organization(name: str) -> None:
    with db.write() as connection:
        connection.execute(insert(organizations).values(name=name))


def test_a_missing_file_is_created_with_the_data(database):
    """R4"""
    assert not database.exists()
    seeding.prepare_database()
    assert counts() == {"organizations": 24, "contacts": 60, "deals": 96, "activities": 220, "stage_changes": 230}


def test_a_second_start_changes_nothing(database):
    """R4"""
    seeding.prepare_database()
    add_organization("Added by hand")
    before = counts()
    seeding.prepare_database()
    assert counts() == before
    assert names()[-1] == "Added by hand"


def test_deleting_every_record_does_not_bring_the_data_back(database):
    """R4"""
    seeding.prepare_database()
    with db.write() as connection:
        for table in (deals, contacts, organizations):
            connection.execute(delete(table))
    seeding.prepare_database()
    assert set(counts().values()) == {0}


def test_loading_that_stops_halfway_is_done_again(database, monkeypatch):
    """R4"""

    def broken_rows(today):
        rows = sample_rows(today)
        rows["deals"][50]["stage"] = "no such stage"
        return rows

    with monkeypatch.context() as patch:
        patch.setattr(seeding, "sample_rows", broken_rows)
        with pytest.raises(Exception, match="known_stage"):
            seeding.prepare_database()
    assert set(counts().values()) == {0}

    seeding.prepare_database()
    assert counts()["deals"] == 96
    assert len(names()) == 24


def test_the_copy_has_the_same_rows_also_while_another_connection_reads(database):
    """R5"""
    seeding.prepare_database()
    add_organization("Added by hand")
    reading, finished = threading.Event(), threading.Event()

    def read_for_a_while():
        with db.read() as connection:
            rows = connection.execution_options(stream_results=True).execute(select(deals))
            rows.fetchone()
            reading.set()
            finished.wait(10)

    reader = threading.Thread(target=read_for_a_while)
    reader.start()
    reading.wait(10)
    copy = seeding.save_copy()
    finished.set()
    reader.join()

    assert copy.parent == database.parent / "backups"
    assert copy.name.startswith("accountable-2026-11-24-")
    with closing(sqlite3.connect(copy)) as connection:
        assert connection.execute("select count(*) from deals").fetchone() == (96,)
        assert connection.execute("select name from organizations order by id desc").fetchone() == ("Added by hand",)


def test_a_copy_never_replaces_an_earlier_one(database):
    """R5"""
    seeding.prepare_database()
    copies = {seeding.save_copy() for _ in range(5)}
    assert len(copies) == 5
    assert all(copy.exists() for copy in copies)


def test_a_reset_brings_back_the_sample_data(database):
    """R5"""
    seeding.prepare_database()
    sample = names()
    add_organization("Added by hand")
    seeding.reset()
    assert names() == sample
    assert counts()["deals"] == 96


def test_a_reset_that_fails_leaves_the_old_data(database, monkeypatch):
    """R5"""
    seeding.prepare_database()
    add_organization("Added by hand")
    before = counts()

    def broken_rows(today):
        rows = sample_rows(today)
        rows["activities"][100]["type"] = "no such type"
        return rows

    monkeypatch.setattr(seeding, "sample_rows", broken_rows)
    with pytest.raises(Exception, match="known_type"):
        seeding.reset()
    assert counts() == before
    assert names()[-1] == "Added by hand"
