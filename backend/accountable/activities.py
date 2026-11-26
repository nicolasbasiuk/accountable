"""Activities (A1 to A3)."""

from sqlalchemy import Connection, Row, insert, select, update
from sqlalchemy import delete as delete_from

from accountable import clock, db
from accountable.errors import Invalid, NotFound
from accountable.tables import activities, contacts, deals


def add(values: dict) -> int:
    """Logged on a contact or a deal. On a deal, it remembers the main contact (A5)."""
    values = {**values, "happened_at": values.get("happened_at") or clock.now(), "done": False}
    _check_time(values)
    with db.write() as connection:
        if values.get("deal_id"):
            deal = _linked(connection, deals, "deal_id", values["deal_id"])
            values["deal_contact_id"] = deal.contact_id
        else:
            _linked(connection, contacts, "contact_id", values["contact_id"])
        return connection.execute(insert(activities).values(values)).inserted_primary_key[0]


def edit(activity_id: int, values: dict) -> None:
    values = dict(values)
    _check_time(values)
    with db.write() as connection:
        activity = _row(connection, activity_id)
        if not values.get("follow_up_on", activity.follow_up_on):
            values["done"] = False  # There's nothing to have done.
        if values:
            connection.execute(update(activities).where(activities.c.id == activity_id).values(values))


def delete(activity_id: int) -> None:
    with db.write() as connection:
        _row(connection, activity_id)
        connection.execute(delete_from(activities).where(activities.c.id == activity_id))


def _row(connection: Connection, activity_id: int) -> Row:
    row = connection.execute(select(activities).where(activities.c.id == activity_id)).first()
    if not row:
        raise NotFound
    return row


def _linked(connection: Connection, table, field: str, record_id: int) -> Row:
    row = connection.execute(select(table).where(table.c.id == record_id)).first()
    if not row:
        raise Invalid({field: f"This {field.removesuffix('_id')} no longer exists."})
    return row


def _check_time(values: dict) -> None:
    if values.get("happened_at") and values["happened_at"].replace(microsecond=0) > clock.now():
        raise Invalid({"happened_at": "This can't be in the future."})
