import pytest
from sqlalchemy import select

from accountable import db
from accountable.tables import activities


def ids(api, path: str, kind: str = "activity") -> list[int]:
    return [entry["id"] for entry in api.get(f"{path}/timeline") if entry["kind"] == kind]


# Where entries show


def test_on_a_deal_and_its_main_contact_but_not_on_a_later_one(api):
    """A4, A5"""
    first, later = api.contact(), api.contact("Wen Zhao")
    deal = api.deal(contact_id=first)
    activity = api.activity(deal_id=deal)
    change = api.move(deal, "qualified")
    api.patch(f"/deals/{deal}", {"contact_id": later})

    for path in (f"/deals/{deal}", f"/contacts/{first}"):
        assert ids(api, path) == [activity]
        assert ids(api, path, "stage_change") == [change["id"]]
    assert api.get(f"/contacts/{later}/timeline") == []

    newer = api.activity(deal_id=deal)
    assert ids(api, f"/contacts/{later}") == [newer]
    assert ids(api, f"/contacts/{first}") == [activity]
    assert set(ids(api, f"/deals/{deal}")) == {activity, newer}


def test_on_a_deal_with_no_main_contact(api):
    """Nobody is remembered, so it isn't on a later main contact either."""
    contact, deal = api.contact(), api.deal()
    activity = api.activity(deal_id=deal)
    api.patch(f"/deals/{deal}", {"contact_id": contact})
    assert ids(api, f"/deals/{deal}") == [activity]
    assert ids(api, f"/contacts/{contact}") == []


def test_on_a_contact_but_not_on_their_deals(api):
    """A6"""
    contact = api.contact()
    deal = api.deal(contact_id=contact)
    activity = api.activity(contact_id=contact)
    assert ids(api, f"/contacts/{contact}") == [activity]
    assert ids(api, f"/deals/{deal}") == []


def test_an_organization_shows_each_entry_once(api):
    """A7"""
    organization, elsewhere = api.organization(), api.organization("Elsewhere")
    contact = api.contact(organization_id=organization)
    outsider = api.contact("Wen Zhao", organization_id=elsewhere)
    deal = api.deal(organization_id=organization, contact_id=contact)
    outside_deal = api.deal(organization_id=elsewhere, contact_id=contact)
    with_outsider = api.deal(organization_id=organization, contact_id=outsider)

    expected = {
        api.activity("On the deal", deal_id=deal),
        api.activity("On the contact", contact_id=contact),
        # Through its contact, though the deal is elsewhere, and the other way round.
        api.activity("On a deal elsewhere", deal_id=outside_deal),
        api.activity("With someone elsewhere", deal_id=with_outsider),
    }
    api.activity("Not theirs", contact_id=outsider)
    change = api.move(deal, "qualified")

    shown = ids(api, f"/organizations/{organization}")
    assert set(shown) == expected
    assert len(shown) == len(expected)
    assert ids(api, f"/organizations/{organization}", "stage_change") == [change["id"]]


def test_a_contact_who_leaves_takes_theirs_along(api):
    """A7"""
    organization, new_employer = api.organization(), api.organization("New employer")
    contact = api.contact(organization_id=organization)
    deal = api.deal(organization_id=organization, contact_id=contact)
    on_contact = api.activity(contact_id=contact)
    on_deal = api.activity(deal_id=deal)
    api.patch(f"/contacts/{contact}", {"organization_id": new_employer})
    assert ids(api, f"/organizations/{organization}") == [on_deal]
    assert set(ids(api, f"/organizations/{new_employer}")) == {on_contact, on_deal}


# What an entry says (A8)


def test_newest_first_also_at_the_same_time(api):
    deal = api.deal()
    old = api.activity(deal_id=deal, happened_at="2026-11-01T10:00:00Z")
    same_1 = api.activity(deal_id=deal, happened_at="2026-11-10T10:00:00Z")
    same_2 = api.activity(deal_id=deal, happened_at="2026-11-10T10:00:00Z")
    oldest = api.activity(deal_id=deal, happened_at="2026-10-01T10:00:00Z")
    assert ids(api, f"/deals/{deal}") == [same_2, same_1, old, oldest]


def test_stage_changes_and_activities_are_mixed_by_time(api):
    deal = api.deal()
    before = api.activity(deal_id=deal, happened_at="2026-11-01T10:00:00Z")
    change = api.move(deal, "qualified")
    entries = api.get(f"/deals/{deal}/timeline")
    assert [(entry["kind"], entry["id"]) for entry in entries] == [("stage_change", change["id"]), ("activity", before)]


def test_each_entry_names_its_record(api):
    organization = api.organization()
    contact = api.contact(organization_id=organization)
    deal = api.deal(organization_id=organization, contact_id=contact)
    api.activity(contact_id=contact)
    api.activity(deal_id=deal)
    api.move(deal, "qualified")
    its_organization = {"id": organization, "name": "Upland Water"}
    on_deal = {"kind": "deal", "id": deal, "name": "Cloud migration", "organization": its_organization}
    on_contact = {"kind": "contact", "id": contact, "name": "Priya Nair", "organization": its_organization}
    records = [(entry["kind"], entry["record"]) for entry in api.get(f"/organizations/{organization}/timeline")]
    assert sorted(records, key=str) == sorted([("activity", on_contact), ("activity", on_deal), ("stage_change", on_deal)], key=str)


def test_a_record_without_an_organization(api):
    contact = api.contact()
    api.activity(contact_id=contact)
    [entry] = api.get(f"/contacts/{contact}/timeline")
    assert entry["record"] == {"kind": "contact", "id": contact, "name": "Priya Nair", "organization": None}


def test_times_leave_in_utc(api):
    contact = api.contact()
    api.activity(contact_id=contact, happened_at="2026-11-10T10:00:00+05:00")
    [entry] = api.get(f"/contacts/{contact}/timeline")
    assert entry["at"] == "2026-11-10T05:00:00Z"


# Log, edit and delete (A1 to A3)


@pytest.mark.parametrize("kind", ["note", "call", "email"])
@pytest.mark.parametrize("record", ["contact", "deal"])
def test_log_edit_and_delete(api, kind, record):
    record_id = getattr(api, record)()
    path = f"/{record}s/{record_id}"
    activity = api.post("/activities", {"type": kind, "description": "First call", "follow_up_on": "2026-12-01", f"{record}_id": record_id}, 201)["id"]
    [entry] = api.get(f"{path}/timeline")
    assert (entry["type"], entry["description"], entry["follow_up_on"], entry["done"]) == (kind, "First call", "2026-12-01", False)

    api.patch(f"/activities/{activity}", {"description": "Second call", "type": "note", "happened_at": "2026-11-02T09:30:00Z"})
    [entry] = api.get(f"{path}/timeline")
    assert (entry["type"], entry["description"], entry["at"], entry["follow_up_on"]) == ("note", "Second call", "2026-11-02T09:30:00Z", "2026-12-01")

    api.delete(f"/activities/{activity}")
    assert api.get(f"{path}/timeline") == []
    api.get(path)


def test_done_and_not_done(api):
    """A3"""
    contact = api.contact()
    activity = api.activity(contact_id=contact, follow_up_on="2026-12-01")
    for done in (True, False):
        api.patch(f"/activities/{activity}", {"done": done})
        assert api.get(f"/contacts/{contact}/timeline")[0]["done"] is done


def test_without_a_follow_up_there_is_nothing_to_have_done(api):
    contact = api.contact()
    activity = api.activity(contact_id=contact, follow_up_on="2026-12-01")
    api.patch(f"/activities/{activity}", {"done": True})
    api.patch(f"/activities/{activity}", {"follow_up_on": None})
    entry = api.get(f"/contacts/{contact}/timeline")[0]
    assert (entry["follow_up_on"], entry["done"]) == (None, False)
    api.patch(f"/activities/{activity}", {"done": True})
    assert api.get(f"/contacts/{contact}/timeline")[0]["done"] is False


@pytest.mark.parametrize("field", ["contact_id", "deal_id", "deal_contact_id"])
def test_the_record_cannot_be_changed(api, field):
    """A2"""
    activity = api.activity(contact_id=api.contact())
    other = api.contact("Wen Zhao")
    assert api.patch(f"/activities/{activity}", {field: other}, 422)["fields"] == {field: "This can't be changed."}


def test_logged_on_exactly_one_record(api):
    contact, deal = api.contact(), api.deal()
    body = {"type": "note", "description": "A"}
    api.post("/activities", body, 422)
    api.post("/activities", {**body, "contact_id": contact, "deal_id": deal}, 422)
    assert api.post("/activities", {**body, "deal_id": 99}, 422)["fields"] == {"deal_id": "This deal no longer exists."}
    assert api.post("/activities", {**body, "contact_id": 99}, 422)["fields"] == {"contact_id": "This contact no longer exists."}


@pytest.mark.parametrize("description", ["", "   ", None])
def test_a_description_is_required(api, description):
    """A1"""
    contact = api.contact()
    body = {"type": "note", "description": description, "contact_id": contact}
    assert api.post("/activities", body, 422)["fields"] == {"description": "Enter a description."}
    activity = api.activity(contact_id=contact)
    assert api.patch(f"/activities/{activity}", {"description": description}, 422)["fields"] == {"description": "Enter a description."}


def test_the_time_cannot_be_in_the_future(api):
    """A1"""
    contact = api.contact()
    body = {"type": "note", "description": "A", "contact_id": contact}
    message = {"happened_at": "This can't be in the future."}
    assert api.post("/activities", {**body, "happened_at": "2026-11-26T00:00:00Z"}, 422)["fields"] == message
    activity = api.activity(contact_id=contact)
    assert api.patch(f"/activities/{activity}", {"happened_at": "2026-11-26T00:00:00Z"}, 422)["fields"] == message


def test_the_time_is_now_unless_given(api):
    """A1"""
    contact = api.contact()
    before = api.get("/config")["now"]
    api.activity(contact_id=contact)
    after = api.get("/config")["now"]
    assert before <= api.get(f"/contacts/{contact}/timeline")[0]["at"] <= after


def test_a_stage_change_cannot_be_edited_or_deleted(api):
    """A5: there's no way to, and an activity's way can't reach one."""
    deal = api.deal()
    change = api.move(deal, "qualified")
    api.patch(f"/activities/{change['id']}", {"description": "A"}, 404)
    api.delete(f"/activities/{change['id']}", 404)
    for method in ("PATCH", "DELETE"):
        assert api.client.request(method, f"/api/stage_changes/{change['id']}").status_code == 404
    assert len(api.get(f"/deals/{deal}/timeline")) == 1


def test_deal_activities_remember_nobody_for_contacts(api):
    activity = api.activity(contact_id=api.contact())
    with db.read() as connection:
        row = connection.execute(select(activities).where(activities.c.id == activity)).one()
    assert (row.deal_id, row.deal_contact_id) == (None, None)
