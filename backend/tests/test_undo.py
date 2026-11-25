from datetime import date

import pytest

from accountable.stages import STAGES


@pytest.mark.parametrize("to_stage", [stage for stage in STAGES if stage != "qualified"])
def test_undo_puts_everything_back(api, to_stage):
    """P8"""
    organization = api.organization()
    contact = api.contact(status="qualified", organization_id=organization)
    below = api.deal("Below", stage="qualified")
    deal = api.deal("Moved", stage="qualified", probability=33, close_date="2027-02-01", contact_id=contact, organization_id=organization)
    above = api.deal("Above", stage="qualified")
    already_there = api.deal("Already there", stage=to_stage)
    before = api.get(f"/deals/{deal}")

    change = api.move(deal, to_stage, already_there)
    assert api.get(f"/deals/{deal}") != before
    api.undo(deal, change)

    assert api.get(f"/deals/{deal}") == before
    assert api.get(f"/contacts/{contact}")["status"] == "qualified"
    assert api.column("qualified") == [above, deal, below]
    assert api.column(to_stage) == [already_there]
    for path in (f"/deals/{deal}", f"/contacts/{contact}", f"/organizations/{organization}"):
        assert api.get(f"{path}/timeline") == []
    assert api.get("/dashboard")["recent"] == []


def test_a_contact_who_was_already_a_customer_stays_one(api):
    """P8"""
    contact = api.contact(status="customer")
    deal = api.deal(contact_id=contact)
    api.undo(deal, api.move(deal, "won"))
    assert api.get(f"/contacts/{contact}")["status"] == "customer"


def test_a_status_changed_by_hand_since_is_kept(api):
    contact = api.contact(status="qualified")
    deal = api.deal(contact_id=contact)
    change = api.move(deal, "won")
    api.patch(f"/contacts/{contact}", {"status": "lead"})
    api.undo(deal, change)
    assert api.get(f"/contacts/{contact}")["status"] == "lead"


def test_the_status_put_back_is_the_remembered_contacts(api):
    winner, later = api.contact(), api.contact("Wen Zhao", status="customer")
    deal = api.deal(contact_id=winner)
    change = api.move(deal, "won")
    api.patch(f"/deals/{deal}", {"contact_id": later})
    api.undo(deal, change)
    assert api.get(f"/contacts/{winner}")["status"] == "lead"
    assert api.get(f"/contacts/{later}")["status"] == "customer"


def won_twice(api) -> tuple[int, int, dict, int, dict]:
    """A contact, and two of their deals won one after the other, with each change of stage."""
    contact = api.contact()
    first, second = api.deal("First", contact_id=contact), api.deal("Second", contact_id=contact)
    return contact, first, api.move(first, "won"), second, api.move(second, "won")


def test_a_contact_with_a_deal_won_since_stays_a_customer(api):
    """P8, C4: without the first win, the second would have made them a customer."""
    contact, first, change, second, second_change = won_twice(api)
    api.undo(first, change)
    assert api.get(f"/contacts/{contact}")["status"] == "customer"
    api.undo(second, second_change)
    assert api.get(f"/contacts/{contact}")["status"] == "lead"


def test_two_wins_undone_from_the_latest(api):
    """P8"""
    contact, first, change, second, second_change = won_twice(api)
    api.undo(second, second_change)
    assert api.get(f"/contacts/{contact}")["status"] == "customer"
    api.undo(first, change)
    assert api.get(f"/contacts/{contact}")["status"] == "lead"


def test_a_contact_with_a_deal_added_as_won_since_stays_a_customer(api):
    """P8, C4: a deal added as Won can't be undone."""
    contact = api.contact()
    deal = api.deal(contact_id=contact)
    change = api.move(deal, "won")
    api.deal("Added", stage="won", contact_id=contact)
    api.undo(deal, change)
    assert api.get(f"/contacts/{contact}")["status"] == "customer"


def test_a_deal_won_before_does_not_keep_a_status(api):
    """P8: they were made a lead by hand after it."""
    contact = api.contact()
    api.deal("Before", stage="won", contact_id=contact)
    api.patch(f"/contacts/{contact}", {"status": "lead"})
    deal = api.deal(contact_id=contact)
    api.undo(deal, api.move(deal, "won"))
    assert api.get(f"/contacts/{contact}")["status"] == "lead"


def test_a_status_set_by_hand_between_two_wins_comes_back(api):
    """P8"""
    contact = api.contact()
    first, second = api.deal("First", contact_id=contact), api.deal("Second", contact_id=contact)
    change = api.move(first, "won")
    api.patch(f"/contacts/{contact}", {"status": "qualified"})
    second_change = api.move(second, "won")
    api.undo(first, change)
    assert api.get(f"/contacts/{contact}")["status"] == "customer"
    api.undo(second, second_change)
    assert api.get(f"/contacts/{contact}")["status"] == "qualified"


def test_after_the_remembered_contact_is_deleted(api):
    contact = api.contact()
    deal = api.deal(contact_id=contact)
    change = api.move(deal, "won")
    api.delete(f"/contacts/{contact}")
    api.undo(deal, change)
    assert api.get(f"/deals/{deal}")["stage"] == "new"


def test_after_the_column_got_shorter(api):
    others = [api.deal(f"Other {n}") for n in range(3)]
    deal = api.deal("Moved")
    api.move(deal, "new")  # To the end.
    change = api.move(deal, "proposal")
    for other in others[:2]:
        api.delete(f"/deals/{other}")
    api.undo(deal, change)
    assert api.column("new") == [others[2], deal]


def test_an_older_change_is_a_conflict(api):
    """P8"""
    deal = api.deal()
    older = api.move(deal, "qualified")
    newer = api.move(deal, "proposal")
    api.undo(deal, older, 409)
    assert api.get(f"/deals/{deal}")["stage"] == "proposal"
    api.undo(deal, newer)
    assert api.get(f"/deals/{deal}")["stage"] == "qualified"


def test_a_second_undo_is_a_conflict(api):
    """P8"""
    deal = api.deal()
    change = api.move(deal, "qualified")
    api.undo(deal, change)
    api.undo(deal, change, 409)
    # Also after another move, which must not reuse the id.
    api.move(deal, "proposal")
    api.undo(deal, change, 409)
    assert api.get(f"/deals/{deal}")["stage"] == "proposal"


def test_an_unknown_change_is_a_conflict(api):
    """P8"""
    deal, other = api.deal(), api.deal("Other")
    change = api.move(other, "qualified")
    api.undo(deal, {"id": 99}, 409)
    api.undo(deal, change, 409)
    api.undo(99, change, 404)


def test_the_dashboard_is_as_before_the_move(sample):
    """P8, B4"""
    before = {key: sample.get("/dashboard")[key] for key in ("figures", "months", "stages", "funnel", "recent", "late")}
    deal = sample.column("negotiation")[2]
    change = sample.move(deal, "won")
    assert sample.get("/dashboard")["funnel"] != before["funnel"]
    sample.undo(deal, change)
    assert {key: sample.get("/dashboard")[key] for key in before} == before


def test_the_close_date_comes_back_after_midnight(api, on_day):
    deal = api.deal(close_date="2027-02-01")
    change = api.move(deal, "won")
    on_day(date(2026, 11, 25))
    api.undo(deal, change)
    assert api.get(f"/deals/{deal}")["close_date"] == "2027-02-01"
