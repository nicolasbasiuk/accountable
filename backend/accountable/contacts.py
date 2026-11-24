"""Contacts (C1 to C3)."""

from sqlalchemy import Connection, Row, Select, delete as delete_from, func, insert, or_, select, update

from accountable import clock, db, stages, timelines
from accountable.errors import Invalid, NotFound
from accountable.tables import activities, contacts, deals, organizations


def list_all() -> list[dict]:
    with db.read() as connection:
        rows = connection.execute(_with_organization().order_by(contacts.c.name, contacts.c.id)).all()
        last = timelines.last_activity(connection)
        following = timelines.next_follow_up(connection)
    return [
        {**_contact(row), "last_activity": clock.as_text(last.get(row.id)), "next_follow_up": following.get(row.id)} for row in rows
    ]


def get(contact_id: int) -> dict:
    """Their fields, organization, and the deals where they're the main contact (C2)."""
    today = clock.today()
    with db.read() as connection:
        contact = _contact(_row(connection, contact_id))
        their_deals = connection.execute(
            select(deals).where(deals.c.contact_id == contact_id).order_by(deals.c.close_date.desc(), deals.c.id.desc())
        ).all()
    return {
        **contact,
        "deals": [
            {
                "id": deal.id,
                "name": deal.name,
                "stage": deal.stage,
                "value": deal.value,
                "close_date": deal.close_date,
                "days_late": stages.days_late(deal.stage, deal.close_date, today),
            }
            for deal in their_deals
        ],
    }


def add(values: dict) -> int:
    with db.write() as connection:
        _check_organization(connection, values)
        return connection.execute(insert(contacts).values(values)).inserted_primary_key[0]


def edit(contact_id: int, values: dict) -> None:
    with db.write() as connection:
        _row(connection, contact_id)
        _check_organization(connection, values)
        if values:
            connection.execute(update(contacts).where(contacts.c.id == contact_id).values(values))


def deletion(contact_id: int) -> dict:
    """What deleting them does to others (X1)."""
    logged = activities.c.contact_id == contact_id
    to_do = activities.c.follow_up_on.is_not(None) & activities.c.done.is_(False)
    with db.read() as connection:
        _row(connection, contact_id)
        return {
            "deals": connection.scalar(select(func.count()).where(deals.c.contact_id == contact_id)),
            "activities": connection.scalar(select(func.count()).where(logged)),
            "follow_ups": connection.scalar(select(func.count()).where(logged, to_do)),
        }


def delete(contact_id: int) -> None:
    """Their deals stay, with no main contact, and so do the activities on those deals. The links in the database do that."""
    with db.write() as connection:
        _row(connection, contact_id)
        connection.execute(delete_from(contacts).where(contacts.c.id == contact_id))


def _with_organization() -> Select:
    return select(contacts, organizations.c.name.label("organization_name")).outerjoin(
        organizations, organizations.c.id == contacts.c.organization_id
    )


def _row(connection: Connection, contact_id: int) -> Row:
    row = connection.execute(_with_organization().where(contacts.c.id == contact_id)).first()
    if not row:
        raise NotFound
    return row


def _contact(row: Row) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "email": row.email,
        "phone": row.phone,
        "job_title": row.job_title,
        "status": row.status,
        "organization": {"id": row.organization_id, "name": row.organization_name} if row.organization_id else None,
    }


def _check_organization(connection: Connection, values: dict) -> None:
    organization_id = values.get("organization_id")
    if organization_id and not connection.execute(select(organizations.c.id).where(organizations.c.id == organization_id)).first():
        raise Invalid({"organization_id": "This organization no longer exists."})
