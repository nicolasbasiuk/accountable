"""Timelines: the activities and changes of stage of a deal, a contact, an organization or everything (A4 to A8)."""

from datetime import date, datetime

from sqlalchemy import ColumnElement, Connection, Select, func, or_, select, true, union_all

from accountable import clock, db
from accountable.errors import NotFound
from accountable.tables import activities, contacts, deals, organizations, stage_changes


def for_deal(deal_id: int) -> list[dict]:
    with db.read() as connection:
        _must_exist(connection, deals, deal_id)
        return _entries(connection, activities.c.deal_id == deal_id, stage_changes.c.deal_id == deal_id)


def for_contact(contact_id: int) -> list[dict]:
    """What was logged on them, and what remembers them as a deal's main contact (A6)."""
    with db.read() as connection:
        _must_exist(connection, contacts, contact_id)
        return _entries(
            connection,
            or_(activities.c.contact_id == contact_id, activities.c.deal_contact_id == contact_id),
            stage_changes.c.contact_id == contact_id,
        )


def for_organization(organization_id: int) -> list[dict]:
    """Everything in the timelines of its current contacts and deals, each entry once (A7)."""
    with db.read() as connection:
        _must_exist(connection, organizations, organization_id)
        people = select(contacts.c.id).where(contacts.c.organization_id == organization_id)
        its_deals = select(deals.c.id).where(deals.c.organization_id == organization_id)
        return _entries(
            connection,
            or_(activities.c.contact_id.in_(people), activities.c.deal_contact_id.in_(people), activities.c.deal_id.in_(its_deals)),
            or_(stage_changes.c.contact_id.in_(people), stage_changes.c.deal_id.in_(its_deals)),
        )


def newest(connection: Connection, amount: int) -> list[dict]:
    """The newest entries of all timelines, each once (B6)."""
    return _entries(connection, true(), true(), amount)


def follow_ups(connection: Connection, until: date) -> list[dict]:
    """Those not done and due by a day, soonest first (B5)."""
    to_do = (activities.c.follow_up_on <= until) & activities.c.done.is_(False)
    query = _activities(to_do).order_by(activities.c.follow_up_on, activities.c.id)
    return [_activity_entry(row) for row in connection.execute(query).mappings()]


def last_activity(connection: Connection) -> dict[int, datetime]:
    """Each contact's newest entry (T5)."""
    moments = union_all(
        select(activities.c.contact_id.label("contact_id"), activities.c.happened_at.label("at")),
        select(activities.c.deal_contact_id, activities.c.happened_at),
        select(stage_changes.c.contact_id, stage_changes.c.changed_at),
    ).subquery()
    return _by_contact(connection, moments.c.contact_id, func.max(moments.c.at))


def next_follow_up(connection: Connection) -> dict[int, date]:
    """Each contact's earliest follow-up that isn't done (T5)."""
    to_do = activities.c.done.is_(False) & activities.c.follow_up_on.is_not(None)
    days = union_all(
        select(activities.c.contact_id.label("contact_id"), activities.c.follow_up_on.label("day")).where(to_do),
        select(activities.c.deal_contact_id, activities.c.follow_up_on).where(to_do),
    ).subquery()
    return _by_contact(connection, days.c.contact_id, func.min(days.c.day))


def _by_contact(connection: Connection, contact_id: ColumnElement, value: ColumnElement) -> dict:
    query = select(contact_id, value).where(contact_id.is_not(None)).group_by(contact_id)
    return {row[0]: row[1] for row in connection.execute(query)}


def _must_exist(connection: Connection, table, record_id: int) -> None:
    if not connection.execute(select(table.c.id).where(table.c.id == record_id)).first():
        raise NotFound


def _entries(connection: Connection, which_activities: ColumnElement, which_changes: ColumnElement, amount: int | None = None) -> list[dict]:
    """Newest first, then highest id (A8)."""
    activity_rows = connection.execute(_activities(which_activities).order_by(activities.c.happened_at.desc(), activities.c.id.desc()).limit(amount))
    change_rows = connection.execute(_changes(which_changes).order_by(stage_changes.c.changed_at.desc(), stage_changes.c.id.desc()).limit(amount))
    entries = [_activity_entry(row) for row in activity_rows.mappings()] + [_change_entry(row) for row in change_rows.mappings()]
    entries.sort(key=lambda entry: (entry["at"], entry["id"], entry["kind"]), reverse=True)
    return entries[:amount]


def _activities(which: ColumnElement) -> Select:
    organization_id = func.coalesce(deals.c.organization_id, contacts.c.organization_id)
    return (
        select(
            activities,
            deals.c.name.label("deal_name"),
            contacts.c.name.label("contact_name"),
            organizations.c.id.label("organization_id"),
            organizations.c.name.label("organization_name"),
        )
        .outerjoin(deals, deals.c.id == activities.c.deal_id)
        .outerjoin(contacts, contacts.c.id == activities.c.contact_id)
        .outerjoin(organizations, organizations.c.id == organization_id)
        .where(which)
    )


def _changes(which: ColumnElement) -> Select:
    return (
        select(
            stage_changes,
            deals.c.name.label("deal_name"),
            organizations.c.id.label("organization_id"),
            organizations.c.name.label("organization_name"),
        )
        .join(deals, deals.c.id == stage_changes.c.deal_id)
        .outerjoin(organizations, organizations.c.id == deals.c.organization_id)
        .where(which)
    )


def _activity_entry(row) -> dict:
    return {
        "kind": "activity",
        "id": row["id"],
        "at": clock.as_text(row["happened_at"]),
        "type": row["type"],
        "description": row["description"],
        "follow_up_on": row["follow_up_on"],
        "done": row["done"],
        "from_stage": None,
        "to_stage": None,
        "record": _record(row, "deal") if row["deal_id"] else _record(row, "contact"),
    }


def _change_entry(row) -> dict:
    return {
        "kind": "stage_change",
        "id": row["id"],
        "at": clock.as_text(row["changed_at"]),
        "type": None,
        "description": None,
        "follow_up_on": None,
        "done": None,
        "from_stage": row["from_stage"],
        "to_stage": row["to_stage"],
        "record": _record(row, "deal"),
    }


def _record(row, kind: str) -> dict:
    """The deal or contact an entry belongs to, with its organization."""
    organization = {"id": row["organization_id"], "name": row["organization_name"]} if row["organization_id"] else None
    return {"kind": kind, "id": row[f"{kind}_id"], "name": row[f"{kind}_name"], "organization": organization}
