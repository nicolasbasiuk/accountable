"""Deals (D1 to D7). What a change of stage does is in pipeline.py."""

from sqlalchemy import Connection, Row, Select, func, insert, select, update
from sqlalchemy import delete as delete_from

from accountable import clock, db, pipeline, stages
from accountable.errors import Invalid, NotFound
from accountable.tables import activities, contacts, deals, organizations


def list_all() -> list[dict]:
    with db.read() as connection:
        rows = connection.execute(_with_links().order_by(deals.c.close_date.desc(), deals.c.id.desc())).all()
    return [_deal(row) for row in rows]


def get(deal_id: int) -> dict:
    with db.read() as connection:
        return _deal(_row(connection, deal_id))


def add(values: dict) -> int:
    """A new deal goes to the top of its column. Added as Won, its main contact becomes a customer (C4)."""
    stage = values["stage"]
    values = {**values, "probability": stages.probability_for(stage, values.get("probability"))}
    with db.write() as connection:
        _check_links(connection, values)
        pipeline.check_close_date(stage, values["close_date"])
        deal_id = connection.execute(insert(deals).values(**values, position=0)).inserted_primary_key[0]
        pipeline.put_on_top(connection, stage, deal_id)
        if stage == "won":
            pipeline.add_as_won(connection, values.get("contact_id"))
        return deal_id


def edit(deal_id: int, values: dict) -> None:
    with db.write() as connection:
        deal = _row(connection, deal_id)
        _check_links(connection, values)
        edits = {name: value for name, value in values.items() if name != "stage"}
        stage = values.get("stage", deal.stage)
        if stage != deal.stage:
            pipeline.change_stage(connection, deal, stage, edits, pipeline.TOP)
            return
        if stage in stages.CLOSED:
            edits.pop("probability", None)  # Fixed (D3).
        pipeline.check_close_date(stage, edits.get("close_date", deal.close_date))
        if edits:
            connection.execute(update(deals).where(deals.c.id == deal_id).values(edits))


def deletion(deal_id: int) -> dict:
    """What deleting it does to others (X1)."""
    logged = activities.c.deal_id == deal_id
    to_do = activities.c.follow_up_on.is_not(None) & activities.c.done.is_(False)
    with db.read() as connection:
        _row(connection, deal_id)
        return {
            "activities": connection.scalar(select(func.count()).where(logged)),
            "follow_ups": connection.scalar(select(func.count()).where(logged, to_do)),
        }


def delete(deal_id: int) -> None:
    """Its activities and changes of stage go with it. The links in the database do that."""
    with db.write() as connection:
        deal = _row(connection, deal_id)
        connection.execute(delete_from(deals).where(deals.c.id == deal_id))
        pipeline.number_column(connection, deal.stage)


def _with_links() -> Select:
    return (
        select(deals, organizations.c.name.label("organization_name"), contacts.c.name.label("contact_name"))
        .outerjoin(organizations, organizations.c.id == deals.c.organization_id)
        .outerjoin(contacts, contacts.c.id == deals.c.contact_id)
    )


def _row(connection: Connection, deal_id: int) -> Row:
    row = connection.execute(_with_links().where(deals.c.id == deal_id)).first()
    if not row:
        raise NotFound
    return row


def _deal(row: Row) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "organization": {"id": row.organization_id, "name": row.organization_name} if row.organization_id else None,
        "contact": {"id": row.contact_id, "name": row.contact_name} if row.contact_id else None,
        "stage": row.stage,
        "value": row.value,
        "probability": row.probability,
        "expected_revenue": row.value * row.probability / 100,
        "close_date": row.close_date,
        "days_late": stages.days_late(row.stage, row.close_date, clock.today()),
    }


def _check_links(connection: Connection, values: dict) -> None:
    problems = {}
    for field, table, name in (("organization_id", organizations, "organization"), ("contact_id", contacts, "contact")):
        record_id = values.get(field)
        if record_id and not connection.execute(select(table.c.id).where(table.c.id == record_id)).first():
            problems[field] = f"This {name} no longer exists."
    if problems:
        raise Invalid(problems)
