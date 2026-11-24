import re
from collections import Counter
from datetime import date, datetime, time, timedelta

import pytest

from accountable import clock, seeding
from accountable.sample_data import sample_rows
from accountable.stages import CLOSED, OPEN, STAGES, shown_on_board

TODAY = date(2026, 11, 24)
AWKWARD_DAYS = [
    date(2026, 1, 1),
    date(2026, 2, 28),
    date(2028, 2, 29),
    date(2026, 3, 31),
    date(2026, 11, 1),
    TODAY,
    date(2026, 12, 31),
]


@pytest.fixture(params=AWKWARD_DAYS, ids=str)
def day(request) -> date:
    return request.param


@pytest.fixture
def rows(day) -> dict:
    return sample_rows(day)


def entries(rows: dict, deal: dict) -> list[datetime]:
    activities = [row["happened_at"] for row in rows["activities"] if row["deal_id"] == deal["id"]]
    return sorted(activities + [row["changed_at"] for row in changes_of(rows, deal)])


def changes_of(rows: dict, deal: dict) -> list[dict]:
    return [row for row in rows["stage_changes"] if row["deal_id"] == deal["id"]]


def last_12_months(day: date) -> list[tuple[int, int]]:
    months = [day.year * 12 + day.month - 1 - ago for ago in range(12)]
    return [(month // 12, month % 12 + 1) for month in months]


def test_amounts_and_make_up(rows, day):
    """S1"""
    assert len(rows["organizations"]) == 24
    assert len({row["industry"] for row in rows["organizations"]}) >= 8

    statuses = Counter(row["status"] for row in rows["contacts"])
    assert statuses == {"lead": 25, "qualified": 15, "customer": 20}

    stages = Counter(row["stage"] for row in rows["deals"])
    assert stages == {"new": 16, "qualified": 12, "proposal": 9, "negotiation": 7, "won": 34, "lost": 18}
    assert all(5_000 <= row["value"] <= 150_000 for row in rows["deals"])

    assert 210 <= len(rows["activities"]) <= 230
    due = [(row["follow_up_on"] - day).days for row in rows["activities"] if row["follow_up_on"] and not row["done"]]
    assert len([days for days in due if days < 0]) == 6
    assert len([days for days in due if 0 <= days <= 14]) == 10
    assert len([days for days in due if days > 14]) == 9


def test_same_rows_twice():
    """S1"""
    assert sample_rows(TODAY) == sample_rows(TODAY)


def test_spread_over_time(rows, day):
    """S2"""
    won = [row for row in rows["deals"] if row["stage"] == "won"]
    assert {(row["close_date"].year, row["close_date"].month) for row in won} == set(last_12_months(day))
    assert all(row["close_date"] <= day for row in rows["deals"] if row["stage"] in CLOSED)
    assert all((row["close_date"].year, row["close_date"].month) in last_12_months(day) for row in rows["deals"] if row["stage"] == "lost")

    open_deals = [row for row in rows["deals"] if row["stage"] in OPEN]
    late = [row for row in open_deals if row["close_date"] < day]
    assert len(late) == 4
    assert all(day <= row["close_date"] <= day + timedelta(days=120) for row in open_deals if row not in late)

    for stage in CLOSED:
        assert any(shown_on_board(stage, row["close_date"], day) for row in rows["deals"] if row["stage"] == stage)


def test_consistent(rows, day):
    """S3"""
    contacts = {row["id"]: row for row in rows["contacts"]}
    for deal in rows["deals"]:
        path = [change["to_stage"] for change in changes_of(rows, deal)]
        assert path == sorted(path, key=STAGES.index)
        assert (path[-1] if path else "new") == deal["stage"]
        for before, after in zip(["new", *path], path, strict=False):
            change = next(row for row in changes_of(rows, deal) if row["to_stage"] == after)
            assert change["from_stage"] == before

        if deal["stage"] in CLOSED:
            assert 30 <= (deal["close_date"] - entries(rows, deal)[0].astimezone().date()).days <= 120
            assert changes_of(rows, deal)[-1]["changed_at"].astimezone().date() == deal["close_date"]
        else:
            assert 30 <= (deal["close_date"] - entries(rows, deal)[0].astimezone().date()).days <= 120

        contact = contacts.get(deal["contact_id"])
        assert contact is None or contact["organization_id"] == deal["organization_id"]
        if deal["stage"] == "won":
            assert contact["status"] == "customer"

    won_contacts = {row["contact_id"] for row in rows["deals"] if row["stage"] == "won"}
    assert {row["id"] for row in rows["contacts"] if row["status"] == "customer"} == won_contacts

    for activity in rows["activities"]:
        if activity["follow_up_on"]:
            assert activity["follow_up_on"] > activity["happened_at"].astimezone().date()


def test_columns_are_numbered_from_0(rows, day):
    for stage in STAGES:
        positions = sorted(row["position"] for row in rows["deals"] if row["stage"] == stage)
        assert positions == list(range(len(positions)))


def test_invented(rows, day):
    """S4"""
    assert all(row["website"].endswith(".example") for row in rows["organizations"] if row["website"])
    assert all(row["email"].endswith(".example") for row in rows["contacts"] if row["email"])
    phones = [row["phone"] for row in rows["contacts"] if row["phone"]]
    assert all(re.fullmatch(r"\(\d{3}\) 555-01\d\d", phone) for phone in phones)
    assert len(set(phones)) == len(phones)


def test_nothing_is_in_the_future_just_after_midnight(rows, day):
    just_after_midnight = datetime.combine(day, time(0, 1)).astimezone()
    assert all(row["happened_at"] <= just_after_midnight for row in rows["activities"])
    assert all(row["changed_at"] <= just_after_midnight for row in rows["stage_changes"])


def test_loads_on_every_day(day, monkeypatch):
    """The database takes the rows, with its checks and links."""
    monkeypatch.setenv("ACCOUNTABLE_TODAY", day.isoformat())
    seeding.prepare_database()
    assert clock.today() == day
