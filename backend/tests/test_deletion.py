"""X1: what's kept, unlinked and deleted, and that the numbers announced match."""

import pytest
from sqlalchemy import func, select

from accountable import db
from accountable.tables import activities, stage_changes


def amount(table) -> int:
    with db.read() as connection:
        return connection.scalar(select(func.count()).select_from(table))


def test_an_organization(api):
    organization = api.organization()
    people = [api.contact(name, organization_id=organization) for name in ("Priya Nair", "Wen Zhao")]
    deal = api.deal(organization_id=organization, contact_id=people[0])
    api.deal("Elsewhere")
    api.activity(deal_id=deal)
    api.activity(contact_id=people[0])
    api.move(deal, "proposal")

    assert api.get(f"/organizations/{organization}/deletion") == {"contacts": 2, "deals": 1}
    api.delete(f"/organizations/{organization}")

    api.get(f"/organizations/{organization}", 404)
    for person in people:
        assert api.get(f"/contacts/{person}")["organization"] is None
    saved = api.get(f"/deals/{deal}")
    assert saved["organization"] is None
    assert (saved["contact"]["id"], saved["stage"]) == (people[0], "proposal")
    assert (amount(activities), amount(stage_changes)) == (2, 1)
    assert len(api.get(f"/deals/{deal}/timeline")) == 2


def test_a_contact(api):
    organization = api.organization()
    contact = api.contact(organization_id=organization)
    deals = [api.deal(name, contact_id=contact, organization_id=organization) for name in ("One", "Two")]
    api.activity("On the contact", contact_id=contact)
    api.activity("To do", contact_id=contact, follow_up_on="2026-12-01")
    done = api.activity("Done", contact_id=contact, follow_up_on="2026-12-01")
    api.patch(f"/activities/{done}", {"done": True})
    on_deal = api.activity("On the deal", deal_id=deals[0], follow_up_on="2026-12-01")
    change = api.move(deals[0], "proposal")

    assert api.get(f"/contacts/{contact}/deletion") == {"deals": 2, "activities": 3, "follow_ups": 1}
    api.delete(f"/contacts/{contact}")

    for deal in deals:
        saved = api.get(f"/deals/{deal}")
        assert saved["contact"] is None
        assert saved["organization"]["id"] == organization
    # Deal activities and changes of stage are kept, without the contact.
    entries = api.get(f"/deals/{deals[0]}/timeline")
    assert {(entry["kind"], entry["id"]) for entry in entries} == {("activity", on_deal), ("stage_change", change["id"])}
    assert len(api.get(f"/organizations/{organization}/timeline")) == 2
    assert amount(activities) == 1
    with db.read() as connection:
        assert connection.scalar(select(activities.c.deal_contact_id)) is None
        assert connection.scalar(select(stage_changes.c.contact_id)) is None


def test_a_deal(api):
    organization = api.organization()
    contact = api.contact(organization_id=organization)
    deal = api.deal(contact_id=contact, organization_id=organization)
    kept = api.activity("On the contact", contact_id=contact)
    api.activity("On the deal", deal_id=deal)
    api.activity("To do", deal_id=deal, follow_up_on="2026-12-01")
    api.activity("Also to do", deal_id=deal, follow_up_on="2027-06-01")
    api.move(deal, "proposal")

    assert api.get(f"/deals/{deal}/deletion") == {"activities": 3, "follow_ups": 2}
    api.delete(f"/deals/{deal}")

    for path in (f"/contacts/{contact}", f"/organizations/{organization}"):
        assert [entry["id"] for entry in api.get(f"{path}/timeline")] == [kept]
    assert (amount(activities), amount(stage_changes)) == (1, 0)
    assert api.get("/dashboard")["follow_ups"] == []


def test_an_activity(api):
    contact = api.contact()
    kept = api.activity("Kept", contact_id=contact)
    deleted = api.activity("Deleted", contact_id=contact, follow_up_on="2026-12-01")
    api.delete(f"/activities/{deleted}")
    assert [entry["id"] for entry in api.get(f"/contacts/{contact}/timeline")] == [kept]


@pytest.mark.parametrize("path, numbers", [
    ("organizations", {"contacts": 0, "deals": 0}),
    ("contacts", {"deals": 0, "activities": 0, "follow_ups": 0}),
    ("deals", {"activities": 0, "follow_ups": 0}),
])
def test_nothing_linked(api, path, numbers):
    record_id = getattr(api, path.removesuffix("s"))()
    assert api.get(f"/{path}/{record_id}/deletion") == numbers


def test_every_sample_record_can_be_deleted(sample):
    for path in ("organizations", "contacts", "deals"):
        for row in sample.get(f"/{path}"):
            sample.delete(f"/{path}/{row['id']}")
    assert (amount(activities), amount(stage_changes)) == (0, 0)
