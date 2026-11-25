import json
from datetime import datetime

import pytest
from conftest import TODAY


# Add, read, edit and delete (O1, C1, D1)


def test_an_organization(api):
    values = {"name": "Upland Water", "website": "uplandwater.example", "industry": "Utilities", "notes": "A note"}
    record_id = api.post("/organizations", values, 201)["id"]
    assert values.items() <= api.get(f"/organizations/{record_id}").items()

    api.patch(f"/organizations/{record_id}", {"industry": "Energy"})
    assert {**values, "industry": "Energy"}.items() <= api.get(f"/organizations/{record_id}").items()

    api.delete(f"/organizations/{record_id}")
    assert api.get("/organizations") == []


def test_a_contact(api):
    organization = api.organization()
    values = {"name": "Priya Nair", "email": "priya@uplandwater.example", "phone": "(303) 555-0101", "job_title": "IT Manager", "status": "qualified"}
    record_id = api.post("/contacts", {**values, "organization_id": organization}, 201)["id"]
    saved = api.get(f"/contacts/{record_id}")
    assert values.items() <= saved.items()
    assert saved["organization"] == {"id": organization, "name": "Upland Water"}

    api.patch(f"/contacts/{record_id}", {"phone": None})
    edited = api.get(f"/contacts/{record_id}")
    assert edited["phone"] is None
    assert edited["email"] == values["email"]
    assert edited["organization"]["id"] == organization

    api.patch(f"/contacts/{record_id}", {"organization_id": None})
    assert api.get(f"/contacts/{record_id}")["organization"] is None

    api.delete(f"/contacts/{record_id}")
    assert api.get("/contacts") == []


def test_a_contact_is_a_lead_unless_changed(api):
    assert api.get(f"/contacts/{api.contact()}")["status"] == "lead"


def test_a_deal(api):
    organization, contact = api.organization(), api.contact()
    values = {"name": "Cloud migration", "stage": "proposal", "value": 82_000, "probability": 45, "close_date": "2027-01-14"}
    record_id = api.post("/deals", {**values, "organization_id": organization, "contact_id": contact}, 201)["id"]
    saved = api.get(f"/deals/{record_id}")
    assert values.items() <= saved.items()
    assert saved["organization"] == {"id": organization, "name": "Upland Water"}
    assert saved["contact"] == {"id": contact, "name": "Priya Nair"}

    api.patch(f"/deals/{record_id}", {"value": 90_000})
    assert {**values, "value": 90_000}.items() <= api.get(f"/deals/{record_id}").items()
    assert api.get(f"/deals/{record_id}")["contact"]["id"] == contact

    api.delete(f"/deals/{record_id}")
    assert api.get("/deals") == []


def test_a_deal_is_new_unless_changed(api):
    saved = api.get(f"/deals/{api.deal()}")
    assert (saved["stage"], saved["probability"]) == ("new", 10)


def test_an_edit_with_nothing_in_it_changes_nothing(api):
    for path, record_id in (("organizations", api.organization()), ("contacts", api.contact()), ("deals", api.deal())):
        before = api.get(f"/{path}/{record_id}")
        api.patch(f"/{path}/{record_id}", {})
        assert api.get(f"/{path}/{record_id}") == before


def test_text_is_trimmed_and_blanks_are_empty(api):
    record_id = api.organization("  Upland Water ", industry="   ", notes="")
    saved = api.get(f"/organizations/{record_id}")
    assert (saved["name"], saved["industry"], saved["notes"]) == ("Upland Water", None, None)


# Problems beside their field (G6)


@pytest.mark.parametrize("path, body, fields", [
    ("/organizations", {}, {"name": "Enter a name."}),
    ("/organizations", {"name": "   "}, {"name": "Enter a name."}),
    ("/contacts", {}, {"name": "Enter a name."}),
    ("/deals", {}, {"name": "Enter a name.", "value": "Enter a value.", "close_date": "Enter a close date."}),
    ("/deals", {"name": "A", "value": None, "close_date": None}, {"value": "Enter a value.", "close_date": "Enter a close date."}),
])
def test_required_fields(api, path, body, fields):
    assert api.post(path, body, 422)["fields"] == fields


@pytest.mark.parametrize("path, record", [("organizations", "organization"), ("contacts", "contact"), ("deals", "deal")])
def test_a_required_field_cannot_be_emptied(api, path, record):
    record_id = getattr(api, record)()
    assert api.patch(f"/{path}/{record_id}", {"name": ""}, 422)["fields"] == {"name": "Enter a name."}
    assert api.patch(f"/{path}/{record_id}", {"name": None}, 422)["fields"] == {"name": "Enter a name."}


@pytest.mark.parametrize("email", ["priya", "priya@", "@example.com", "priya@example", "pri ya@example.com", "a@b@example.com", "a@example..com"])
def test_an_email_must_look_like_one(api, email):
    answer = api.post("/contacts", {"name": "Priya Nair", "email": email}, 422)
    assert answer["fields"] == {"email": "Enter an email address, such as name@example.com."}


@pytest.mark.parametrize("website", [
    "uplandwater.example", "www.uplandwater.example/about?x=1#top", "https://uplandwater.example", "http://uplandwater.example:8080/a", "HTTPS://Uplandwater.example",
])
def test_good_websites(api, website):
    record_id = api.organization(website=website)
    assert api.get(f"/organizations/{record_id}")["website"] == website


@pytest.mark.parametrize("website", [
    "javascript:alert(1)", "javascript://uplandwater.example/%0aalert(1)", "ftp://uplandwater.example", "data:text/html,hello", "file:///etc/hosts",
    "mailto:priya@uplandwater.example", "https://", "upland water.example", "uplandwater", "https://user@uplandwater.example", "http://[",
])
def test_only_http_and_https_websites(api, website):
    answer = api.post("/organizations", {"name": "Upland Water", "website": website}, 422)
    assert answer["fields"] == {"website": "Enter a website address, such as example.com."}


@pytest.mark.parametrize("field, value, message", [
    ("value", -1, "Enter a value of $0 or more."),
    ("value", 10.5, "Enter a whole number."),
    ("value", 10**15, "Enter a value of $999,999,999,999 or less."),
    ("value", 10**30, "Enter a value of $999,999,999,999 or less."),
    ("probability", -1, "Enter a probability from 0 to 100."),
    ("probability", 101, "Enter a probability from 0 to 100."),
    ("close_date", "soon", "Enter a date."),
    ("close_date", "0026-11-11", "Enter the year with four digits, such as 2026."),
    ("stage", "waiting", "Choose one of the options."),
    ("organization_id", 99, "This organization no longer exists."),
    ("contact_id", 99, "This contact no longer exists."),
])
def test_deal_limits(api, field, value, message):
    body = {"name": "Cloud migration", "value": 10_000, "close_date": "2027-01-14", field: value}
    assert api.post("/deals", body, 422)["fields"] == {field: message}
    assert api.patch(f"/deals/{api.deal()}", {field: value}, 422)["fields"] == {field: message}


@pytest.mark.parametrize("value, probability", [(0, 0), (0, 100), (999_999_999_999, 50)])
def test_values_at_the_limits(api, value, probability):
    saved = api.get(f"/deals/{api.deal(value=value, probability=probability)}")
    assert (saved["value"], saved["probability"]) == (value, probability)


def test_a_contact_at_an_organization_that_has_gone(api):
    answer = api.post("/contacts", {"name": "Priya Nair", "organization_id": 99}, 422)
    assert answer["fields"] == {"organization_id": "This organization no longer exists."}


@pytest.mark.parametrize("path, field", [
    ("/organizations", "name"), ("/organizations", "website"), ("/organizations", "notes"),
    ("/contacts", "name"), ("/contacts", "email"), ("/deals", "name"), ("/activities", "description"),
])
def test_text_that_cannot_be_saved(api, path, field):
    """Half of a character, which JSON can hold but a database can't."""
    whole = {
        "/organizations": {"name": "A"},
        "/contacts": {"name": "A"},
        "/deals": {"name": "A", "value": 1, "close_date": "2026-11-24"},
        "/activities": {"type": "note", "description": "A", "contact_id": api.contact()},
    }[path]
    body = json.dumps({**whole, field: "\ud800"})
    answer = api.client.post(f"/api{path}", content=body, headers={"content-type": "application/json"})
    assert (answer.status_code, set(answer.json()["fields"])) == (422, {field})


def test_a_failed_check_saves_nothing(api):
    record_id = api.organization("Upland Water")
    api.patch(f"/organizations/{record_id}", {"name": "Changed", "website": "ftp://x.example"}, 422)
    assert api.get(f"/organizations/{record_id}")["name"] == "Upland Water"


# Rules


def test_two_contacts_can_share_a_name_and_an_email(api):
    """C1"""
    first = api.contact(email="priya@example.com")
    second = api.contact(email="priya@example.com")
    assert first != second
    assert len(api.get("/contacts")) == 2


def test_a_deal_with_no_organization_or_contact(api):
    """D2"""
    saved = api.get(f"/deals/{api.deal()}")
    assert (saved["organization"], saved["contact"]) == (None, None)


def test_a_deal_whose_contact_works_elsewhere(api):
    """D2"""
    contact = api.contact(organization_id=api.organization("Elsewhere"))
    saved = api.get(f"/deals/{api.deal(organization_id=api.organization(), contact_id=contact)}")
    assert saved["organization"]["name"] == "Upland Water"
    assert saved["contact"]["id"] == contact


@pytest.mark.parametrize("path", ["organizations", "contacts", "deals"])
@pytest.mark.parametrize("record_id", ["99", "0", "-1", "abc", "99999999999999999999"])
def test_a_missing_record(api, path, record_id):
    """G4"""
    for address in (f"/{path}/{record_id}", f"/{path}/{record_id}/timeline", f"/{path}/{record_id}/deletion"):
        assert api.get(address, 404)["message"] == "This record doesn't exist. It may have been deleted."
    api.patch(f"/{path}/{record_id}", {"name": "A"}, 404)
    api.delete(f"/{path}/{record_id}", 404)


def test_a_missing_activity(api):
    api.patch("/activities/99", {"description": "A"}, 404)
    api.delete("/activities/99", 404)


def test_an_id_is_never_used_again(api):
    """An old link mustn't open another record."""
    first = api.organization()
    api.delete(f"/organizations/{first}")
    assert api.organization() != first


# Table columns (T1, T5)


def test_organization_columns(api):
    organization, other = api.organization("Upland Water"), api.organization("Verity Accounting")
    api.contact(organization_id=organization)
    api.contact(organization_id=organization)
    api.deal(organization_id=organization, value=10_000)
    api.deal(organization_id=organization, value=5_000, stage="negotiation")
    api.deal(organization_id=organization, value=99_000, stage="won")
    api.deal(organization_id=organization, value=99_000, stage="lost")
    rows = {row["id"]: row for row in api.get("/organizations")}
    assert (rows[organization]["contacts"], rows[organization]["open_deals"], rows[organization]["open_value"]) == (2, 2, 15_000)
    assert (rows[other]["contacts"], rows[other]["open_deals"], rows[other]["open_value"]) == (0, 0, 0)


def test_deal_columns(api):
    api.deal(value=10_001, probability=33, close_date="2026-11-20")
    [row] = api.get("/deals")
    assert row["expected_revenue"] == pytest.approx(3300.33)
    assert row["days_late"] == 4


def test_last_activity_and_next_follow_up(api):
    """T5"""
    contact, other = api.contact(), api.contact("Wen Zhao")
    deal = api.deal(contact_id=contact)

    def columns(contact_id=contact):
        row = next(row for row in api.get("/contacts") if row["id"] == contact_id)
        return row["last_activity"], row["next_follow_up"]

    assert columns() == (None, None)
    api.activity(contact_id=contact, happened_at="2026-11-01T10:00:00Z", follow_up_on="2026-12-20")
    assert columns() == ("2026-11-01T10:00:00Z", "2026-12-20")
    # On their deal, newer and due sooner.
    sooner = api.activity(deal_id=deal, happened_at="2026-11-02T10:00:00Z", follow_up_on="2026-11-10")
    assert columns() == ("2026-11-02T10:00:00Z", "2026-11-10")
    # Done, so the later one is next.
    api.patch(f"/activities/{sooner}", {"done": True})
    assert columns() == ("2026-11-02T10:00:00Z", "2026-12-20")
    # A change of stage is in their timeline too.
    api.move(deal, "qualified")
    assert datetime.fromisoformat(columns()[0]).astimezone().date() == TODAY
    # Entries stay with the main contact of the time.
    api.patch(f"/deals/{deal}", {"contact_id": other})
    assert columns(other) == (None, None)


# Organization page (O2)


def test_organization_page(api):
    organization = api.organization()
    contact = api.contact(organization_id=organization, job_title="IT Manager")
    open_deal = api.deal(organization_id=organization, value=10_000, close_date="2026-11-21")
    won = api.deal(organization_id=organization, value=20_000, stage="won")
    old = api.deal(organization_id=organization, value=30_000, stage="won", close_date="2020-01-01")
    lost = api.deal(organization_id=organization, value=40_000, stage="lost")
    api.deal(value=99_000)
    page = api.get(f"/organizations/{organization}")
    assert (page["open_value"], page["value_won"]) == (10_000, 50_000)
    assert [person["id"] for person in page["contacts"]] == [contact]
    assert {deal["id"] for deal in page["deals"]} == {open_deal, won, old, lost}
    assert {deal["id"]: deal["days_late"] for deal in page["deals"]}[open_deal] == 3


def test_contact_page(api):
    contact = api.contact()
    deal = api.deal(contact_id=contact)
    api.deal()
    assert [row["id"] for row in api.get(f"/contacts/{contact}")["deals"]] == [deal]
