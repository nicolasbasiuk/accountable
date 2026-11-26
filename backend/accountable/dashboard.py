"""Everything on the dashboard (B1 to B7)."""

from datetime import date, timedelta

from sqlalchemy import Connection, Row, select

from accountable import clock, db, stages, timelines
from accountable.tables import deals, stage_changes

MONTHS = 12
FOLLOW_UP_DAYS = 14
RECENT = 10
FUNNEL = (*stages.OPEN, "won")


def dashboard() -> dict:
    today = clock.today()
    starts = [_month_start(today, MONTHS - 1 - n) for n in range(MONTHS)]
    with db.read() as connection:
        every = connection.execute(select(deals)).all()
        reached = _furthest_stages(connection, every)
        follow_ups = timelines.follow_ups(connection, today + timedelta(days=FOLLOW_UP_DAYS))
        recent = timelines.newest(connection, RECENT)

    open_deals = [deal for deal in every if deal.stage in stages.OPEN]
    in_period = [
        deal for deal in every if deal.stage in stages.CLOSED and starts[0] <= deal.close_date < _month_start(today, -1)
    ]
    won = [deal for deal in in_period if deal.stage == "won"]
    months = [_month(start, won) for start in starts]
    return {
        "today": today,
        "figures": {
            "won_this_month": {"value": months[-1]["value"], "deals": months[-1]["deals"]},
            "won_12_months": _sum(won),
            "open": _sum(open_deals),
            "expected": _expected(open_deals),
        },
        "months": months,
        "stages": [_stage(stage, open_deals) for stage in stages.OPEN],
        "funnel": _funnel(open_deals + in_period, reached),
        "follow_ups": follow_ups,
        "recent": recent,
        "overdue": len([entry for entry in follow_ups if entry["follow_up_on"] < today]),
        "late": len([deal for deal in open_deals if stages.days_late(deal.stage, deal.close_date, today)]),
    }


def _month_start(today: date, months_ago: int) -> date:
    months = today.year * 12 + today.month - 1 - months_ago
    return date(months // 12, months % 12 + 1, 1)


def _sum(some: list[Row]) -> dict:
    return {"value": sum(deal.value for deal in some), "deals": len(some)}


def _expected(some: list[Row]) -> float:
    return sum(deal.value * deal.probability for deal in some) / 100


def _month(start: date, won: list[Row]) -> dict:
    in_month = [deal for deal in won if (deal.close_date.year, deal.close_date.month) == (start.year, start.month)]
    return {"month": start, **_sum(in_month)}


def _stage(stage: str, open_deals: list[Row]) -> dict:
    in_stage = [deal for deal in open_deals if deal.stage == stage]
    return {"stage": stage, **_sum(in_stage), "expected": _expected(in_stage)}


def _furthest_stages(connection: Connection, every: list[Row]) -> dict[int, int]:
    """The place in the funnel of the furthest stage each deal counts at (B4)."""
    changes: dict[int, list[Row]] = {}
    for change in connection.execute(select(stage_changes).order_by(stage_changes.c.id)):
        changes.setdefault(change.deal_id, []).append(change)
    return {deal.id: FUNNEL.index(_furthest(deal, changes.get(deal.id, []))) for deal in every}


def _furthest(deal: Row, changes: list[Row]) -> str:
    if deal.stage == "won":
        return "won"
    if deal.stage == "lost":
        lost_from = [change.from_stage for change in changes if change.to_stage == "lost"]
        if not lost_from:
            return "new"  # Added as Lost.
        return "negotiation" if lost_from[-1] == "won" else lost_from[-1]
    been_in = [deal.stage] + [stage for change in changes for stage in (change.from_stage, change.to_stage)]
    return max((stage for stage in been_in if stage in stages.OPEN), key=stages.OPEN.index)


def _funnel(counted: list[Row], reached: dict[int, int]) -> list[dict]:
    rows = []
    for place, stage in enumerate(FUNNEL):
        row = {"stage": stage, **_sum([deal for deal in counted if reached[deal.id] >= place])}
        before = rows[-1]["value"] if rows else 0
        rows.append({**row, "share": row["value"] / before if before else None})
    return rows
