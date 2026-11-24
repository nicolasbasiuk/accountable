"""Organizations (O1 to O3)."""

from sqlalchemy import Connection, Row, delete as delete_from, func, insert, select, update

from accountable import clock, db, stages
from accountable.errors import NotFound
from accountable.tables import contacts, deals, organizations


def list_all() -> list[dict]:
    people = _per_organization(contacts, func.count().label("amount")).subquery()
    open_deals = (
        _per_organization(deals, func.count().label("amount"), func.sum(deals.c.value).label("value"))
        .where(deals.c.stage.in_(stages.OPEN))
        .subquery()
    )
    query = (
        select(
            organizations,
            func.coalesce(people.c.amount, 0).label("contacts"),
            func.coalesce(open_deals.c.amount, 0).label("open_deals"),
            func.coalesce(open_deals.c.value, 0).label("open_value"),
        )
        .outerjoin(people, people.c.organization_id == organizations.c.id)
        .outerjoin(open_deals, open_deals.c.organization_id == organizations.c.id)
        .order_by(organizations.c.name, organizations.c.id)
    )
    with db.read() as connection:
        return [dict(row) for row in connection.execute(query).mappings()]


def _per_organization(table, *amounts):
    return select(table.c.organization_id, *amounts).group_by(table.c.organization_id)


def get(organization_id: int) -> dict:
    """Its fields, figures, contacts and deals (O2)."""
    today = clock.today()
    with db.read() as connection:
        organization = _row(connection, organization_id)
        people = connection.execute(
            select(contacts).where(contacts.c.organization_id == organization_id).order_by(func.lower(contacts.c.name), contacts.c.id)
        ).all()
        its_deals = connection.execute(
            select(deals).where(deals.c.organization_id == organization_id).order_by(deals.c.close_date.desc(), deals.c.id.desc())
        ).all()
    return {
        **organization._asdict(),
        "open_value": sum(deal.value for deal in its_deals if deal.stage in stages.OPEN),
        "value_won": sum(deal.value for deal in its_deals if deal.stage == "won"),
        "contacts": [
            {"id": person.id, "name": person.name, "job_title": person.job_title, "status": person.status} for person in people
        ],
        "deals": [
            {
                "id": deal.id,
                "name": deal.name,
                "stage": deal.stage,
                "value": deal.value,
                "close_date": deal.close_date,
                "days_late": stages.days_late(deal.stage, deal.close_date, today),
            }
            for deal in its_deals
        ],
    }


def add(values: dict) -> int:
    with db.write() as connection:
        return connection.execute(insert(organizations).values(values)).inserted_primary_key[0]


def edit(organization_id: int, values: dict) -> None:
    with db.write() as connection:
        _row(connection, organization_id)
        if values:
            connection.execute(update(organizations).where(organizations.c.id == organization_id).values(values))


def deletion(organization_id: int) -> dict:
    """What deleting it does to others (X1)."""
    with db.read() as connection:
        _row(connection, organization_id)
        return {
            "contacts": connection.scalar(select(func.count()).where(contacts.c.organization_id == organization_id)),
            "deals": connection.scalar(select(func.count()).where(deals.c.organization_id == organization_id)),
        }


def delete(organization_id: int) -> None:
    """Its contacts and deals stay, with no organization. The links in the database do that."""
    with db.write() as connection:
        _row(connection, organization_id)
        connection.execute(delete_from(organizations).where(organizations.c.id == organization_id))


def _row(connection: Connection, organization_id: int) -> Row:
    row = connection.execute(select(organizations).where(organizations.c.id == organization_id)).first()
    if not row:
        raise NotFound
    return row
