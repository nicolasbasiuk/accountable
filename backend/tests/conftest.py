import os
import tempfile
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from accountable import db, seeding
from accountable.main import app

TODAY = date(2026, 11, 24)


def pytest_configure():
    """Refuses any database outside the tests' own temporary folder, which could be the user's data (R7)."""
    folder = Path(os.environ.get("ACCOUNTABLE_DB") or "unset").parent
    in_temp = folder.parent.resolve() == Path(tempfile.gettempdir()).resolve()
    if not in_temp or not folder.name.startswith("accountable-tests-"):
        raise pytest.UsageError("The tests need a database of their own. Run them with: npm test")


@pytest.fixture(autouse=True)
def database(monkeypatch) -> Path:
    """Each test has its own database file and a fixed day."""
    folder = Path(tempfile.mkdtemp(dir=Path(os.environ["ACCOUNTABLE_DB"]).parent))
    monkeypatch.setenv("ACCOUNTABLE_DB", str(folder / "accountable.db"))
    monkeypatch.setenv("ACCOUNTABLE_TODAY", TODAY.isoformat())
    return folder / "accountable.db"


class Api:
    """Calls the API, checking the status."""

    def __init__(self, client: TestClient):
        self.client = client

    def get(self, path: str, status: int = 200):
        return self._call("GET", path, status)

    def post(self, path: str, body: dict, status: int | None = None):
        return self._call("POST", path, status, json=body)

    def patch(self, path: str, body: dict, status: int = 200):
        return self._call("PATCH", path, status, json=body)

    def delete(self, path: str, status: int = 200):
        return self._call("DELETE", path, status)

    def _call(self, method: str, path: str, status: int | None, **options):
        answer = self.client.request(method, f"/api{path}", **options)
        expected = (200, 201) if status is None else (status,)
        assert answer.status_code in expected, f"{method} {path}: {answer.status_code} {answer.text}"
        return answer.json()

    # Records, with only what a test cares about

    def organization(self, name: str = "Upland Water", **values) -> int:
        return self.post("/organizations", {"name": name, **values})["id"]

    def contact(self, name: str = "Priya Nair", **values) -> int:
        return self.post("/contacts", {"name": name, **values})["id"]

    def deal(self, name: str = "Cloud migration", **values) -> int:
        return self.post("/deals", {"name": name, "value": 10_000, "close_date": "2026-11-24", **values})["id"]

    def activity(self, description: str = "First call", **values) -> int:
        return self.post("/activities", {"type": "call", "description": description, **values})["id"]

    def move(self, deal_id: int, stage: str, before_id: int | None = None) -> dict | None:
        return self.post(f"/deals/{deal_id}/move", {"stage": stage, "before_id": before_id})["stage_change"]

    def undo(self, deal_id: int, change: dict, status: int = 200):
        return self.post(f"/deals/{deal_id}/undo", {"stage_change_id": change["id"]}, status)

    def column(self, stage: str) -> list[int]:
        """The ids of the cards shown in a column, in order."""
        columns = {column["stage"]: column for column in self.get("/board")["columns"]}
        return [card["id"] for card in columns[stage]["cards"]]


@pytest.fixture
def api(database) -> Api:
    """The API on a database with no records."""
    db.create_tables()
    return Api(TestClient(app, base_url="http://localhost", raise_server_exceptions=True))


@pytest.fixture
def sample(api) -> Api:
    """The API on the sample data."""
    seeding.prepare_database()
    return api


@pytest.fixture
def on_day(monkeypatch):
    """Changes the day."""

    def change(day: date) -> None:
        monkeypatch.setenv("ACCOUNTABLE_TODAY", day.isoformat())

    return change
