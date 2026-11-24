from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import select

from accountable import db, pipeline
from accountable.stages import STAGES
from accountable.tables import deals


def positions(stage: str) -> list[int]:
    with db.read() as connection:
        return list(connection.scalars(select(deals.c.position).where(deals.c.stage == stage).order_by(deals.c.position)))


def assert_numbered() -> None:
    for stage in STAGES:
        assert positions(stage) == list(range(len(positions(stage))))


@pytest.fixture
def three(api) -> list[int]:
    """Three new deals, as the column shows them. A new one goes on top (P7)."""
    ids = [api.deal(name) for name in ("C", "B", "A")][::-1]
    assert api.column("new") == ids
    return ids


# To another column (P3)


def test_to_the_top(api, three):
    target = api.deal("X", stage="proposal")
    api.move(three[1], "proposal", target)
    assert api.column("proposal") == [three[1], target]
    assert api.column("new") == [three[0], three[2]]
    assert_numbered()


def test_to_the_middle(api, three):
    second, first = api.deal("Y", stage="proposal"), api.deal("X", stage="proposal")
    api.move(three[0], "proposal", second)
    assert api.column("proposal") == [first, three[0], second]
    assert_numbered()


def test_to_the_end(api, three):
    target = api.deal("X", stage="proposal")
    api.move(three[0], "proposal")
    assert api.column("proposal") == [target, three[0]]
    assert_numbered()


def test_into_an_empty_column(api, three):
    api.move(three[2], "negotiation")
    assert api.column("negotiation") == [three[2]]
    assert_numbered()


# Within a column (P3)


@pytest.mark.parametrize("card, before, expected", [
    (2, 0, [2, 0, 1]),
    (2, 1, [0, 2, 1]),
    (0, 2, [1, 0, 2]),
    (0, None, [1, 2, 0]),
    (1, None, [0, 2, 1]),
    (0, 1, [0, 1, 2]),
])
def test_within_a_column(api, three, card, before, expected):
    api.move(three[card], "new", None if before is None else three[before])
    assert api.column("new") == [three[place] for place in expected]
    assert_numbered()


@pytest.mark.parametrize("stage", STAGES)
def test_within_a_column_nothing_else_changes(api, on_day, stage):
    contact = api.contact()
    first = api.deal("A", stage=stage, close_date="2026-11-20", contact_id=contact)
    api.deal("B", stage=stage, close_date="2026-11-20")
    if stage == "negotiation":
        api.patch(f"/deals/{first}", {"probability": 33})
    api.patch(f"/contacts/{contact}", {"status": "lead"})
    before = api.get(f"/deals/{first}")
    assert api.move(first, stage) is None
    assert api.get(f"/deals/{first}") == before
    assert api.get(f"/deals/{first}/timeline") == []
    assert api.get(f"/contacts/{contact}")["status"] == "lead"


def test_a_move_returns_the_change_of_stage(api, three):
    change = api.move(three[0], "qualified")
    assert (change["from_stage"], change["to_stage"]) == ("new", "qualified")
    [entry] = api.get(f"/deals/{three[0]}/timeline")
    assert entry["id"] == change["id"]


# Cards too old to show (P3, P4)


def test_below_older_hidden_cards_the_order_shown_is_kept(api):
    hidden = [api.deal(f"Old {n}", stage="won", close_date="2020-01-01") for n in range(2)]
    shown = [api.deal(name, stage="won") for name in ("B", "A")][::-1]
    api.patch(f"/deals/{hidden[0]}", {"name": "Still hidden"})
    # Put a hidden card between the two shown ones, and one above them.
    api.move(hidden[0], "won", shown[1])
    api.move(hidden[1], "won", shown[0])
    assert api.column("won") == shown

    top, middle, end = api.deal("T"), api.deal("M"), api.deal("E")
    api.move(top, "won", shown[0])
    assert api.column("won") == [top, *shown]
    api.move(middle, "won", shown[1])
    assert api.column("won") == [top, shown[0], middle, shown[1]]
    api.move(end, "won")
    assert api.column("won") == [top, shown[0], middle, shown[1], end]
    assert_numbered()


# A neighbor that has gone


def test_a_neighbor_that_has_gone_is_a_conflict(api, three):
    gone = api.deal("X", stage="proposal")
    api.delete(f"/deals/{gone}")
    api.post(f"/deals/{three[0]}/move", {"stage": "proposal", "before_id": gone}, 409)
    assert api.column("new") == three


def test_a_neighbor_in_another_column_is_a_conflict(api, three):
    elsewhere = api.deal("X", stage="negotiation")
    answer = api.post(f"/deals/{three[0]}/move", {"stage": "proposal", "before_id": elsewhere}, 409)
    assert answer["message"]
    assert api.column("new") == three


def test_a_card_cannot_go_above_itself(api, three):
    api.post(f"/deals/{three[0]}/move", {"stage": "new", "before_id": three[0]}, 409)


def test_a_missing_deal_cannot_move(api):
    api.post("/deals/99/move", {"stage": "new", "before_id": None}, 404)


# Other ways into a column


def test_an_edited_stage_goes_to_the_top(api, three):
    """D4"""
    target = api.deal("X", stage="proposal")
    api.patch(f"/deals/{three[1]}", {"stage": "proposal"})
    assert api.column("proposal") == [three[1], target]
    assert_numbered()


@pytest.mark.parametrize("stage", STAGES)
def test_a_new_deal_goes_to_the_top(api, stage):
    """P7"""
    first = api.deal("A", stage=stage)
    second = api.deal("B", stage=stage)
    assert api.column(stage) == [second, first]
    assert_numbered()


def test_deleting_a_deal_closes_the_gap(api, three):
    api.delete(f"/deals/{three[1]}")
    assert_numbered()


def test_other_edits_keep_the_place(api, three):
    api.patch(f"/deals/{three[2]}", {"name": "Renamed", "value": 1})
    assert api.column("new") == three


def test_twenty_moves_at_once(sample):
    cards = sample.column("new") + sample.column("qualified")
    targets = ["proposal", "negotiation", "won", "lost", "new"]
    moves = [(deal_id, targets[n % len(targets)]) for n, deal_id in enumerate(cards[:20])]
    with ThreadPoolExecutor(20) as threads:
        list(threads.map(lambda one: pipeline.move(one[0], one[1], None), moves))
    assert_numbered()
    for deal_id, stage in moves:
        assert sample.get(f"/deals/{deal_id}")["stage"] == stage
