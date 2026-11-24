import io
from pathlib import Path

import pytest
import seed
from sqlalchemy import func, insert, select

from accountable import db, seeding
from accountable.tables import organizations


class Terminal(io.StringIO):
    def isatty(self):
        return True


@pytest.fixture(autouse=True)
def data():
    seeding.prepare_database()
    with db.write() as connection:
        connection.execute(insert(organizations).values(name="Added by hand"))


def answer(monkeypatch, text: str) -> None:
    monkeypatch.setattr("sys.stdin", Terminal(text))


def amount() -> int:
    with db.read() as connection:
        return connection.scalar(select(func.count()).select_from(organizations))


def copies(database: Path) -> list[Path]:
    return list((database.parent / "backups").glob("*.db"))


@pytest.mark.parametrize("text", ["yes\n", "y\n", "YES\n"])
def test_yes_resets(monkeypatch, database, text):
    """R5"""
    answer(monkeypatch, text)
    seed.main([])
    assert amount() == 24
    assert len(copies(database)) == 1


@pytest.mark.parametrize("text", ["no\n", "\n", "yesterday\n", ""])
def test_no_changes_nothing_and_leaves_the_copy(monkeypatch, database, text):
    """R5"""
    answer(monkeypatch, text)
    seed.main([])
    assert amount() == 25
    assert len(copies(database)) == 1


def test_the_flag_skips_the_question(monkeypatch, database):
    """R6"""
    monkeypatch.setattr("sys.stdin", io.StringIO())
    seed.main(["--yes"])
    assert amount() == 24


def test_with_no_terminal_and_no_flag_it_fails(monkeypatch, database):
    """R6"""
    monkeypatch.setattr("sys.stdin", io.StringIO("yes\n"))
    with pytest.raises(SystemExit) as error:
        seed.main([])
    assert error.value.code not in (0, None)
    assert amount() == 25
