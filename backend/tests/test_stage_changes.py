from itertools import permutations

import pytest

from accountable.stages import CLOSED, OPEN, STAGES, USUAL_PROBABILITY

PAIRS = list(permutations(STAGES, 2))


def by_edit(api, deal, stage, **values):
    api.patch(f"/deals/{deal}", {"stage": stage, **values})


def by_move(api, deal, stage):
    api.move(deal, stage)


def deal_at(api, stage, **values) -> int:
    return api.deal(stage=stage, close_date="2026-11-20", **values)


def test_the_usual_probabilities():
    assert USUAL_PROBABILITY == {"new": 10, "qualified": 25, "proposal": 50, "negotiation": 75, "won": 100, "lost": 0}


@pytest.mark.parametrize("change", [by_edit, by_move])
@pytest.mark.parametrize("from_stage, to_stage", PAIRS)
def test_the_new_stage_sets_the_probability(api, change, from_stage, to_stage):
    """D3, D4"""
    deal = deal_at(api, from_stage, probability=33)
    change(api, deal, to_stage)
    saved = api.get(f"/deals/{deal}")
    assert (saved["stage"], saved["probability"]) == (to_stage, USUAL_PROBABILITY[to_stage])


@pytest.mark.parametrize("stage", OPEN[1:])
def test_a_probability_given_with_the_change_is_kept(api, stage):
    deal = deal_at(api, "new")
    by_edit(api, deal, stage, probability=33)
    assert api.get(f"/deals/{deal}")["probability"] == 33


@pytest.mark.parametrize("stage", CLOSED)
def test_won_is_always_100_and_lost_0(api, stage):
    """D3"""
    moved = deal_at(api, "new")
    by_edit(api, moved, stage, probability=33)
    added = deal_at(api, stage, probability=33)
    for deal in (moved, added):
        assert api.get(f"/deals/{deal}")["probability"] == USUAL_PROBABILITY[stage]
        api.patch(f"/deals/{deal}", {"probability": 44})
        assert api.get(f"/deals/{deal}")["probability"] == USUAL_PROBABILITY[stage]


@pytest.mark.parametrize("change", [by_edit, by_move])
@pytest.mark.parametrize("stage", CLOSED)
def test_closing_sets_the_close_date_to_today(api, change, stage):
    """D4"""
    deal = api.deal(close_date="2027-03-01")
    change(api, deal, stage)
    assert api.get(f"/deals/{deal}")["close_date"] == "2026-11-24"


@pytest.mark.parametrize("stage", CLOSED)
def test_a_close_date_given_with_the_change_is_kept(api, stage):
    deal = api.deal(close_date="2027-03-01")
    by_edit(api, deal, stage, close_date="2026-11-02")
    assert api.get(f"/deals/{deal}")["close_date"] == "2026-11-02"


@pytest.mark.parametrize("change", [by_edit, by_move])
@pytest.mark.parametrize("from_stage", CLOSED)
def test_reopening_keeps_the_close_date(api, change, from_stage):
    """D4"""
    deal = api.deal(stage=from_stage, close_date="2026-10-05")
    change(api, deal, "proposal")
    assert api.get(f"/deals/{deal}")["close_date"] == "2026-10-05"


@pytest.mark.parametrize("change", [by_edit, by_move])
def test_moving_between_open_stages_keeps_the_close_date(api, change):
    deal = api.deal(close_date="2027-03-01")
    change(api, deal, "negotiation")
    assert api.get(f"/deals/{deal}")["close_date"] == "2027-03-01"


def test_a_probability_set_by_hand_stays_until_the_stage_changes(api):
    """D4"""
    deal = api.deal(stage="qualified")
    api.patch(f"/deals/{deal}", {"probability": 40})
    api.patch(f"/deals/{deal}", {"value": 12_000, "name": "Renamed"})
    by_edit(api, deal, "qualified")
    api.move(deal, "qualified")
    assert api.get(f"/deals/{deal}")["probability"] == 40
    api.move(deal, "proposal")
    assert api.get(f"/deals/{deal}")["probability"] == 50


# The main contact's status (C4)


@pytest.mark.parametrize("change", [by_edit, by_move])
@pytest.mark.parametrize("status", ["lead", "qualified", "customer"])
def test_winning_makes_the_main_contact_a_customer(api, change, status):
    contact = api.contact(status=status)
    change(api, api.deal(contact_id=contact), "won")
    assert api.get(f"/contacts/{contact}")["status"] == "customer"


def test_adding_as_won_makes_the_main_contact_a_customer(api):
    contact = api.contact()
    api.deal(contact_id=contact, stage="won")
    assert api.get(f"/contacts/{contact}")["status"] == "customer"


@pytest.mark.parametrize("change", [by_edit, by_move])
def test_losing_does_not_change_a_status(api, change):
    contact = api.contact(status="qualified")
    change(api, api.deal(contact_id=contact), "lost")
    api.deal(contact_id=contact, stage="lost")
    assert api.get(f"/contacts/{contact}")["status"] == "qualified"


def test_reopening_does_not_change_a_status(api):
    contact = api.contact()
    deal = api.deal(contact_id=contact)
    api.move(deal, "won")
    api.move(deal, "proposal")
    assert api.get(f"/contacts/{contact}")["status"] == "customer"


def test_changing_the_contact_later_does_not_change_a_status(api):
    first, second = api.contact(), api.contact("Wen Zhao")
    deal = api.deal(contact_id=first)
    api.move(deal, "won")
    api.patch(f"/deals/{deal}", {"contact_id": second})
    assert api.get(f"/contacts/{first}")["status"] == "customer"
    assert api.get(f"/contacts/{second}")["status"] == "lead"


def test_a_status_can_always_be_changed_by_hand(api):
    contact = api.contact()
    api.move(api.deal(contact_id=contact), "won")
    api.patch(f"/contacts/{contact}", {"status": "lead"})
    assert api.get(f"/contacts/{contact}")["status"] == "lead"


# The timeline entry (D4, A5)


@pytest.mark.parametrize("change", [by_edit, by_move])
def test_an_entry_is_added(api, change):
    deal = api.deal(stage="proposal")
    change(api, deal, "negotiation")
    [entry] = api.get(f"/deals/{deal}/timeline")
    assert (entry["kind"], entry["from_stage"], entry["to_stage"]) == ("stage_change", "proposal", "negotiation")


def test_the_entry_remembers_the_main_contact_saved_in_the_same_edit(api):
    """A5"""
    before, after = api.contact(), api.contact("Wen Zhao")
    deal = api.deal(contact_id=before)
    by_edit(api, deal, "won", contact_id=after)
    assert api.get(f"/contacts/{before}/timeline") == []
    assert len(api.get(f"/contacts/{after}/timeline")) == 1
    assert api.get(f"/contacts/{before}")["status"] == "lead"
    assert api.get(f"/contacts/{after}")["status"] == "customer"


def test_the_same_stage_again_is_not_a_change(api):
    deal = api.deal(stage="proposal")
    by_edit(api, deal, "proposal")
    assert api.get(f"/deals/{deal}/timeline") == []


def test_a_change_of_stage_saves_the_other_edits_too(api):
    deal = api.deal()
    by_edit(api, deal, "proposal", name="Renamed", value=7_000)
    saved = api.get(f"/deals/{deal}")
    assert (saved["name"], saved["value"], saved["stage"]) == ("Renamed", 7_000, "proposal")


# The close date of a closed deal (D6)


@pytest.mark.parametrize("stage", CLOSED)
def test_a_closed_deals_date_cannot_be_after_today(api, stage):
    message = {"close_date": f"A {stage} deal's close date can't be after today."}
    body = {"name": "A", "value": 1, "stage": stage, "close_date": "2026-11-25"}
    assert api.post("/deals", body, 422)["fields"] == message

    deal = api.deal(close_date="2026-12-25")
    assert api.patch(f"/deals/{deal}", {"stage": stage, "close_date": "2026-12-25"}, 422)["fields"] == message
    saved = api.get(f"/deals/{deal}")
    assert (saved["stage"], saved["close_date"]) == ("new", "2026-12-25")
    assert api.get(f"/deals/{deal}/timeline") == []

    # A move always uses today.
    api.move(deal, stage)
    assert api.get(f"/deals/{deal}")["close_date"] == "2026-11-24"
    assert api.patch(f"/deals/{deal}", {"close_date": "2026-11-25"}, 422)["fields"] == message
    api.patch(f"/deals/{deal}", {"close_date": "2026-11-23"})


def test_a_refused_win_does_not_make_a_customer(api):
    contact = api.contact()
    deal = api.deal(contact_id=contact)
    api.patch(f"/deals/{deal}", {"stage": "won", "close_date": "2026-12-25"}, 422)
    assert api.get(f"/contacts/{contact}")["status"] == "lead"


# Late (D5)


@pytest.mark.parametrize("stage", OPEN)
@pytest.mark.parametrize(
    "close_date, days", [("2026-11-23", 1), ("2026-11-14", 10), ("2026-11-24", 0), ("2026-11-25", 0)]
)
def test_late(api, stage, close_date, days):
    assert api.get(f"/deals/{api.deal(stage=stage, close_date=close_date)}")["days_late"] == days


@pytest.mark.parametrize("stage", CLOSED)
def test_a_closed_deal_is_never_late(api, stage):
    assert api.get(f"/deals/{api.deal(stage=stage, close_date='2026-01-01')}")["days_late"] == 0
