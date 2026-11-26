"""The board, and every way a deal's stage or place can change (D4, P3 to P5, P8)."""

from collections.abc import Sequence
from datetime import date

from sqlalchemy import Connection, Row, bindparam, delete, insert, select, update

from accountable import clock, db, stages
from accountable.errors import Conflict, Invalid, NotFound
from accountable.tables import contacts, deals, organizations, stage_changes

TOP = 0


def board() -> dict:
    """Six columns with their cards in order, and the figures of P5."""
    today = clock.today()
    query = (
        select(deals, organizations.c.name.label("organization"))
        .outerjoin(organizations, organizations.c.id == deals.c.organization_id)
        .order_by(deals.c.position, deals.c.id)
    )
    with db.read() as connection:
        rows = connection.execute(query).all()
    columns = []
    for stage in stages.STAGES:
        cards = [
            _card(row, today)
            for row in rows
            if row.stage == stage and stages.shown_on_board(stage, row.close_date, today)
        ]
        columns.append({"stage": stage, **_totals(cards), "cards": cards})
    open_cards = [card for column in columns if column["stage"] in stages.OPEN for card in column["cards"]]
    return {**_totals(open_cards), "columns": columns}


def _card(row: Row, today: date) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "organization": row.organization,
        "value": row.value,
        "probability": row.probability,
        "close_date": row.close_date,
        "days_late": stages.days_late(row.stage, row.close_date, today),
    }


def _totals(cards: list[dict]) -> dict:
    return {
        "count": len(cards),
        "value": sum(card["value"] for card in cards),
        "expected": sum(card["value"] * card["probability"] for card in cards) / 100,
    }


def move(deal_id: int, stage: str, before_id: int | None) -> dict | None:
    """Puts a deal above another card, or at the end of a column. Returns the change of stage, if there was one."""
    with db.write() as connection:
        deal = _deal(connection, deal_id)
        column = [other for other in _column(connection, stage) if other != deal_id]
        if before_id is not None and before_id not in column:
            raise Conflict("The card next to it has moved, so the board has been loaded again.")
        place = len(column) if before_id is None else column.index(before_id)
        if stage == deal.stage:
            _number(connection, _with(column, deal_id, place))
            return None
        return change_stage(connection, deal, stage, {}, place)


def change_stage(connection: Connection, deal: Row, to_stage: str, edits: dict, place: int) -> dict:
    """Everything that happens when a deal's stage changes (D4). Used by edits and moves."""
    other_edits = {name: value for name, value in edits.items() if name not in ("probability", "close_date")}
    if other_edits:
        connection.execute(update(deals).where(deals.c.id == deal.id).values(other_edits))
    contact_id = other_edits.get("contact_id", deal.contact_id)

    given_date = edits.get("close_date", clock.today() if to_stage in stages.CLOSED else deal.close_date)
    connection.execute(
        update(deals)
        .where(deals.c.id == deal.id)
        .values(
            stage=to_stage,
            probability=stages.probability_for(to_stage, edits.get("probability")),
            close_date=given_date,
        )
    )
    change = {
        "deal_id": deal.id,
        "contact_id": contact_id,
        "from_stage": deal.stage,
        "to_stage": to_stage,
        "changed_at": clock.now(),
        "from_probability": deal.probability,
        "from_close_date": deal.close_date,
        "from_position": deal.position,
        "from_status": make_customer(connection, contact_id) if to_stage == "won" else None,
    }
    change_id = connection.execute(insert(stage_changes).values(change)).inserted_primary_key[0]

    number_column(connection, deal.stage)
    _number(connection, _with([other for other in _column(connection, to_stage) if other != deal.id], deal.id, place))
    check_close_date(to_stage, given_date)
    return {"id": change_id, "from_stage": deal.stage, "to_stage": to_stage}


def undo(deal_id: int, stage_change_id: int) -> None:
    """Puts back what a deal's latest change of stage changed, and removes the change (P8)."""
    with db.write() as connection:
        deal = _deal(connection, deal_id)
        latest = connection.execute(
            select(stage_changes).where(stage_changes.c.deal_id == deal_id).order_by(stage_changes.c.id.desc()).limit(1)
        ).first()
        if not latest or latest.id != stage_change_id or latest.to_stage != deal.stage:
            raise Conflict("This move can't be undone, because the deal has changed since.")

        connection.execute(
            update(deals)
            .where(deals.c.id == deal_id)
            .values(stage=latest.from_stage, probability=latest.from_probability, close_date=latest.from_close_date)
        )
        if latest.from_status and latest.contact_id:
            _put_status_back(connection, latest)
        number_column(connection, latest.to_stage)
        column = [other for other in _column(connection, latest.from_stage) if other != deal_id]
        _number(connection, _with(column, deal_id, latest.from_position))
        connection.execute(delete(stage_changes).where(stage_changes.c.id == latest.id))


def _put_status_back(connection: Connection, win: Row) -> None:
    later_win = connection.execute(
        select(stage_changes)
        .where(
            stage_changes.c.contact_id == win.contact_id, stage_changes.c.to_stage == "won", stage_changes.c.id > win.id
        )
        .order_by(stage_changes.c.id)
        .limit(1)
    ).first()
    if not later_win:
        # Unless it was changed by hand since, which is kept.
        connection.execute(
            update(contacts)
            .where(contacts.c.id == win.contact_id, contacts.c.status == "customer")
            .values(status=win.from_status)
        )
    elif not later_win.from_status:
        # Without this win, the later one would have made them a customer, so undoing that one puts the status back.
        connection.execute(
            update(stage_changes).where(stage_changes.c.id == later_win.id).values(from_status=win.from_status)
        )


def add_as_won(connection: Connection, contact_id: int | None) -> None:
    """C4. Adding a deal can't be undone, so its contact stays a customer when an earlier win is undone."""
    make_customer(connection, contact_id)
    if contact_id:
        connection.execute(
            update(stage_changes).where(stage_changes.c.contact_id == contact_id).values(from_status=None)
        )


def make_customer(connection: Connection, contact_id: int | None) -> str | None:
    """Makes a won deal's main contact a customer (C4). Returns their earlier status if that changed it."""
    status = connection.scalar(select(contacts.c.status).where(contacts.c.id == contact_id))
    if status in (None, "customer"):
        return None
    connection.execute(update(contacts).where(contacts.c.id == contact_id).values(status="customer"))
    return status


def check_close_date(stage: str, close_date: date) -> None:
    """D6"""
    if stage in stages.CLOSED and close_date > clock.today():
        raise Invalid({"close_date": f"A {stages.NAMES[stage].lower()} deal's close date can't be after today."})


def put_on_top(connection: Connection, stage: str, deal_id: int) -> None:
    _number(connection, _with([other for other in _column(connection, stage) if other != deal_id], deal_id, TOP))


def number_column(connection: Connection, stage: str) -> None:
    """Closes the gaps in a column, so its cards are numbered from 0."""
    _number(connection, _column(connection, stage))


def _deal(connection: Connection, deal_id: int) -> Row:
    deal = connection.execute(select(deals).where(deals.c.id == deal_id)).first()
    if not deal:
        raise NotFound
    return deal


def _column(connection: Connection, stage: str) -> Sequence[int]:
    """Every deal in a stage in order, also those too old to show on the board."""
    return connection.scalars(
        select(deals.c.id).where(deals.c.stage == stage).order_by(deals.c.position, deals.c.id)
    ).all()


def _with(column: Sequence[int], deal_id: int, place: int) -> list[int]:
    return [*column[:place], deal_id, *column[place:]]


def _number(connection: Connection, column: Sequence[int]) -> None:
    if column:
        connection.execute(
            update(deals).where(deals.c.id == bindparam("deal")).values(position=bindparam("place")),
            [{"deal": deal_id, "place": place} for place, deal_id in enumerate(column)],
        )
