import pytest

from accountable.stages import CLOSED, OPEN


def test_six_columns_in_order(api):
    """P1"""
    assert [column["stage"] for column in api.get("/board")["columns"]] == ["new", "qualified", "proposal", "negotiation", "won", "lost"]


def test_cards_in_order_with_their_fields(api):
    """P2"""
    organization = api.organization()
    low = api.deal("Low", stage="proposal", value=8_000, close_date="2026-11-20")
    top = api.deal("Top", stage="proposal", value=10_000, probability=40, close_date="2027-01-01", organization_id=organization)
    cards = api.get("/board")["columns"][2]["cards"]
    assert cards == [
        {"id": top, "name": "Top", "organization": "Upland Water", "value": 10_000, "probability": 40, "close_date": "2027-01-01", "days_late": 0},
        {"id": low, "name": "Low", "organization": None, "value": 8_000, "probability": 50, "close_date": "2026-11-20", "days_late": 4},
    ]


@pytest.mark.parametrize("stage", CLOSED)
def test_closed_90_days_ago_shows_and_91_does_not(api, stage):
    """P4"""
    edge = api.deal("90 days ago", stage=stage, close_date="2026-08-26")
    api.deal("91 days ago", stage=stage, close_date="2026-08-25")
    today = api.deal("Today", stage=stage, close_date="2026-11-24")
    assert api.column(stage) == [today, edge]


@pytest.mark.parametrize("stage", OPEN)
def test_open_deals_always_show(api, stage):
    old, far = api.deal("Old", stage=stage, close_date="2020-01-01"), api.deal("Far", stage=stage, close_date="2030-01-01")
    assert api.column(stage) == [far, old]


def test_totals(api):
    """P5"""
    api.deal(value=10_000, probability=10)
    api.deal(value=5_001, probability=33)
    api.deal(value=20_000, stage="negotiation")
    api.deal(value=70_000, stage="won")
    api.deal(value=80_000, stage="won", close_date="2020-01-01")
    api.deal(value=30_000, stage="lost")
    board = api.get("/board")
    assert (board["count"], board["value"]) == (3, 35_001)
    assert board["expected"] == pytest.approx(1_000 + 1650.33 + 15_000)

    columns = {column["stage"]: (column["count"], column["value"], column["expected"]) for column in board["columns"]}
    assert columns["new"] == (2, 15_001, pytest.approx(2650.33))
    assert columns["qualified"] == (0, 0, 0)
    assert columns["negotiation"] == (1, 20_000, 15_000)
    # Only the cards shown.
    assert columns["won"] == (1, 70_000, 70_000)
    assert columns["lost"] == (1, 30_000, 0)
