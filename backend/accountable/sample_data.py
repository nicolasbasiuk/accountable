"""The sample data for a given day (S1 to S4): plain rows, the same each time for the same day."""

from datetime import date, datetime, time, timedelta
from itertools import pairwise
from random import Random

from accountable import sample_words as words
from accountable.stages import OPEN, USUAL_PROBABILITY

SEED = "accountable-162"

DEALS_IN_STAGE = {"new": 16, "qualified": 12, "proposal": 9, "negotiation": 7, "won": 34, "lost": 18}
LOST_FROM = ["new"] * 5 + ["qualified"] * 5 + ["proposal"] * 4 + ["negotiation"] * 4
WON_IN_MONTH = [2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3]  # The last 12 months, oldest first.
QUALIFIED_CONTACTS = 15

# For open deals: days late for the first one in each stage, days until the others close,
# and the fewest days since it started, so that its changes of stage fit.
DAYS_LATE = {"new": 4, "qualified": 7, "proposal": 5, "negotiation": 11}
CLOSES_IN = {"new": (45, 115), "qualified": (21, 105), "proposal": (10, 72), "negotiation": (4, 48)}
STARTED_DAYS_AGO = {"new": 1, "qualified": 4, "proposal": 10, "negotiation": 18}
DURATION = (30, 120)

# Follow-ups still to do, in days from today.
DUE_ON_DEALS = [-8, -7, -6, -4, -1] + [0, 0, 1, 3, 6, 6, 8, 10, 13] + [16, 18, 21, 24, 30, 34, 38, 45]
DUE_ON_CONTACTS = [-5, 7, 27]
NOTES_ON_CONTACTS = 22
DONE_FOLLOW_UPS_ON_CONTACTS = 8


def sample_rows(today: date) -> dict[str, list[dict]]:
    organizations = _organizations()
    contacts = _contacts()
    deals = _deals(today, contacts)
    changes = _stage_changes(deals)
    _set_statuses(contacts, deals, changes)
    activities = _activities(today, contacts, deals)
    return {
        "organizations": organizations,
        "contacts": contacts,
        "deals": [_deal_row(deal) for deal in deals],
        "stage_changes": changes,
        "activities": activities,
    }


# Days and times


def _days(start: date, end: date) -> list[date]:
    """The working days from start to end, or all of them if there are none."""
    every = [start + timedelta(days=n) for n in range((end - start).days + 1)]
    return [day for day in every if day.weekday() < 5] or every


def _at(day: date, today: date, random: Random, hours: tuple[int, int] = (9, 17)) -> datetime:
    """A moment in working hours. Today's is at 0:00, so it's never in the future."""
    if day == today:
        moment = time(0, 0)
    else:
        moment = time(random.randrange(*hours), random.randrange(0, 60, 5))
    return datetime.combine(day, moment).astimezone()


def _first_of_month(today: date, months_ago: int) -> date:
    months = today.year * 12 + today.month - 1 - months_ago
    return date(months // 12, months % 12 + 1, 1)


# Records


def _organizations() -> list[dict]:
    return [
        {"id": number, "name": name, "industry": industry, "website": website, "notes": notes}
        for number, (name, industry, website, notes) in enumerate(words.ORGANIZATIONS, start=1)
    ]


def _contacts() -> list[dict]:
    """Two or three at each organization, and two on their own."""
    rows = []
    for number, name in enumerate(words.CONTACTS, start=1):
        place = (number - 1) % len(words.ORGANIZATIONS)
        at_organization = number <= len(words.CONTACTS) - 2
        domain = words.ORGANIZATIONS[place][2] if at_organization else "postbox.example"
        rows.append(
            {
                "id": number,
                "name": name,
                "email": f"{name.lower().replace(' ', '.')}@{domain}",
                "phone": f"({words.AREA_CODES[number % len(words.AREA_CODES)]}) 555-01{number:02d}"
                if number % 13
                else None,
                "job_title": words.JOB_TITLES[
                    (number + 5 * ((number - 1) // len(words.ORGANIZATIONS))) % len(words.JOB_TITLES)
                ]
                if at_organization
                else None,
                "status": "lead",
                "organization_id": place + 1 if at_organization else None,
            }
        )
    return rows


def _deals(today: date, contacts: list[dict]) -> list[dict]:
    """Four deals for each organization, with the moment each one started and each of its changes of stage."""
    random = Random(SEED)
    stages = [stage for stage, amount in DEALS_IN_STAGE.items() for _ in range(amount)]
    random.shuffle(stages)
    places = [number for number in range(len(words.ORGANIZATIONS)) for _ in range(4)]
    services = {place: random.sample(words.SERVICES, 4) for place in range(len(words.ORGANIZATIONS))}

    won_months = [month for month, amount in enumerate(WON_IN_MONTH) for _ in range(amount)]
    random.shuffle(won_months)
    lost_from = random.sample(LOST_FROM, len(LOST_FROM))
    seen = dict.fromkeys(DEALS_IN_STAGE, 0)

    deals = []
    for number, (place, stage) in enumerate(zip(places, stages, strict=True), start=1):
        name, low, high = services[place].pop()
        people = [contact for contact in contacts if contact["organization_id"] == place + 1]
        in_stage = seen[stage]
        seen[stage] += 1
        deal = {
            "id": number,
            "name": name,
            "organization_id": place + 1,
            "contact_id": _main_contact(random, people, stage, in_stage),
            "stage": stage,
            "value": random.randrange(low * 1000, high * 1000 + 1, 500),
            "probability": USUAL_PROBABILITY[stage],
        }
        if stage == "won":
            _close(deal, today, _won_day(today, won_months[in_stage], number), list(OPEN))
        elif stage == "lost":
            # One about every 18 days, the latest 4 days ago.
            close_date = today - timedelta(days=4 + 18 * in_stage)
            close_date = _days(close_date - timedelta(days=2), close_date)[-1]
            _close(deal, today, close_date, list(OPEN[: OPEN.index(lost_from[in_stage]) + 1]))
        else:
            _leave_open(deal, today, in_stage)
        deals.append(deal)

    # Those that changed last are at the top of their column, as if each had been moved there.
    for stage in DEALS_IN_STAGE:
        column = sorted(
            (deal for deal in deals if deal["stage"] == stage), key=lambda deal: deal["entered"][-1][1], reverse=True
        )
        for position, deal in enumerate(column):
            deal["position"] = position
    return deals


def _main_contact(random: Random, people: list[dict], stage: str, in_stage: int) -> int | None:
    if stage == "new" and in_stage % 6 == 5:
        return None  # A few new deals don't have one yet.
    # Most of an organization's deals are with the same person.
    return random.choices(people, weights=[5, 1, 1][: len(people)])[0]["id"]


def _won_day(today: date, month: int, number: int) -> date:
    months_ago = len(WON_IN_MONTH) - 1 - month
    start = _first_of_month(today, months_ago)
    end = today if months_ago == 0 else _first_of_month(today, months_ago - 1) - timedelta(days=1)
    return Random(f"{SEED} won {number}").choice(_days(start, end))


def _close(deal: dict, today: date, close_date: date, stages: list[str]) -> None:
    """Works back from the close date: one to four months, through the given stages."""
    random = Random(f"{SEED} closed {deal['id']}")
    started = _started(random, close_date, close_date - timedelta(days=DURATION[0]))
    days = [
        started,
        *sorted(random.sample(_days(started + timedelta(days=1), close_date - timedelta(days=1)), len(stages) - 1)),
        close_date,
    ]
    deal["close_date"] = close_date
    deal["entered"] = [
        (stage, _at(day, today, random, (9, 12))) for stage, day in zip([*stages, deal["stage"]], days, strict=True)
    ]


def _started(random: Random, close_date: date, latest: date) -> date:
    return random.choice(_days(close_date - timedelta(days=DURATION[1]), latest))


def _leave_open(deal: dict, today: date, in_stage: int) -> None:
    random = Random(f"{SEED} open {deal['id']}")
    stage = deal["stage"]
    stages = list(OPEN[: OPEN.index(stage) + 1])
    closes_in = -DAYS_LATE[stage] if in_stage == 0 else random.randint(*CLOSES_IN[stage])
    close_date = today + timedelta(days=closes_in)
    latest_start = min(close_date - timedelta(days=DURATION[0]), today - timedelta(days=STARTED_DAYS_AGO[stage]))
    started = _started(random, close_date, latest_start)
    between = _days(started + timedelta(days=1), today - timedelta(days=1)) if len(stages) > 1 else []
    days = [started, *sorted(random.sample(between, len(stages) - 1))]
    deal["close_date"] = close_date
    deal["entered"] = [(passed, _at(day, today, random, (9, 12))) for passed, day in zip(stages, days, strict=True)]
    if in_stage == 1 and stage != "new":
        deal["probability"] += 10  # Set by hand.


def _deal_row(deal: dict) -> dict:
    return {key: value for key, value in deal.items() if key != "entered"}


def _stage_changes(deals: list[dict]) -> list[dict]:
    rows = []
    for deal in deals:
        steps = deal["entered"]
        for (from_stage, _), (to_stage, changed_at) in pairwise(steps):
            rows.append(
                {
                    "deal_id": deal["id"],
                    "contact_id": deal["contact_id"],
                    "from_stage": from_stage,
                    "to_stage": to_stage,
                    "changed_at": changed_at,
                    "from_probability": USUAL_PROBABILITY[from_stage],
                    "from_close_date": deal["close_date"],
                    "from_position": 0,
                    "from_status": None,
                }
            )
    return _numbered(rows, "changed_at")


def _set_statuses(contacts: list[dict], deals: list[dict], changes: list[dict]) -> None:
    """A won deal's main contact is a customer, and those furthest along without one are qualified (S3)."""
    by_id = {contact["id"]: contact for contact in contacts}
    for change in changes:
        if change["to_stage"] == "won" and by_id[change["contact_id"]]["status"] != "customer":
            change["from_status"] = "qualified"
            by_id[change["contact_id"]]["status"] = "customer"

    def furthest(contact: dict) -> int:
        stages = [
            OPEN.index(deal["stage"]) for deal in deals if deal["contact_id"] == contact["id"] and deal["stage"] in OPEN
        ]
        return max(stages, default=-1)

    others = [contact for contact in contacts if contact["status"] == "lead"]
    for contact in sorted(others, key=furthest, reverse=True)[:QUALIFIED_CONTACTS]:
        contact["status"] = "qualified"


# Activities


def _activities(today: date, contacts: list[dict], deals: list[dict]) -> list[dict]:
    rows = []
    for deal in deals:
        rows += _history(deal, today)
    rows += _to_do_on_deals(deals, today)
    rows += _on_contacts(contacts, today)
    return _numbered(rows, "happened_at")


def _activity(
    words_: tuple[str, str], happened_at: datetime, *, deal: dict | None = None, contact: dict | None = None
) -> dict:
    kind, description = words_
    return {
        "type": kind,
        "description": description,
        "happened_at": happened_at,
        "follow_up_on": None,
        "done": False,
        "contact_id": contact["id"] if contact else None,
        "deal_id": deal["id"] if deal else None,
        "deal_contact_id": deal["contact_id"] if deal else None,
    }


def _history(deal: dict, today: date) -> list[dict]:
    """What happened on a deal, stage by stage. Its first activity is when it started."""
    random = Random(f"{SEED} history {deal['id']}")
    steps = deal["entered"]
    ends = [entered for _, entered in steps[1:]]
    if deal["stage"] in OPEN:
        ends.append(datetime.combine(today, time(0, 0)).astimezone())
        wanted = {"new": [0], "qualified": [0, 1], "proposal": [0, 2], "negotiation": [0, 2, 3]}[deal["stage"]]
    elif deal["stage"] == "won":
        wanted = [0, random.choice([2, 3])]
    else:
        wanted = [0] if len(steps) < 4 else [0, len(steps) - 2]

    rows = []
    for index in wanted:
        stage, entered = steps[index]
        if index == 0:
            happened_at = entered
        else:
            last_day = ends[index].date() - timedelta(days=1)
            # Not in the last third of the time, or most would be from the last few days.
            last_day -= (last_day - entered.date()) // 3
            day = random.choice(_days(entered.date(), max(entered.date(), last_day)))
            happened_at = _at(day, today, random, (13, 17))
        rows.append(_activity(random.choice(words.ON_DEALS[stage]), happened_at, deal=deal))
    if deal["stage"] == "won" and random.random() < 0.4:
        rows[0]["follow_up_on"] = rows[0]["happened_at"].date() + timedelta(days=random.randint(2, 9))
        rows[0]["done"] = True
    if deal["stage"] == "lost" and len(rows) > 1:
        rows[-1] = _activity(random.choice(words.ON_DEALS["lost"]), rows[-1]["happened_at"], deal=deal)
    return rows


def _to_do_on_deals(deals: list[dict], today: date) -> list[dict]:
    """One follow-up each for half of the open deals. The overdue ones are on those that moved longest ago."""
    random = Random(f"{SEED} to do")
    waiting = sorted((deal for deal in deals if deal["stage"] in OPEN), key=lambda deal: deal["entered"][-1][1])
    overdue = len([days for days in DUE_ON_DEALS if days < 0])
    chosen = waiting[:overdue] + random.sample(waiting[overdue:], len(DUE_ON_DEALS) - overdue)
    texts = {stage: random.sample(pool, len(pool)) for stage, pool in words.TO_DO_ON_DEALS.items()}

    rows = []
    for days, deal in zip(DUE_ON_DEALS, chosen, strict=True):
        stage, entered = deal["entered"][-1]
        due = today + timedelta(days=days)
        last_day = min(due, today) - timedelta(days=1)
        first_day = max(entered.date(), last_day - timedelta(days=20))
        text = texts[stage].pop(0)
        texts[stage].append(text)
        row = _activity(text, _at(random.choice(_days(first_day, last_day)), today, random, (13, 17)), deal=deal)
        row["follow_up_on"] = due
        rows.append(row)
    return rows


def _on_contacts(contacts: list[dict], today: date) -> list[dict]:
    random = Random(f"{SEED} contacts")
    people = random.sample(contacts, NOTES_ON_CONTACTS)
    rows = []
    for number, contact in enumerate(people):
        day = random.choice(_days(today - timedelta(days=100), today - timedelta(days=2)))
        row = _activity(words.ON_CONTACTS[number % len(words.ON_CONTACTS)], _at(day, today, random), contact=contact)
        if number < DONE_FOLLOW_UPS_ON_CONTACTS:
            row["follow_up_on"] = day + timedelta(days=random.randint(2, 10))
            row["done"] = True
        rows.append(row)
    for days, text, contact in zip(DUE_ON_CONTACTS, words.TO_DO_ON_CONTACTS, people, strict=False):
        last_day = today + timedelta(days=min(days, 0) - 1)
        row = _activity(
            text, _at(random.choice(_days(last_day - timedelta(days=6), last_day)), today, random), contact=contact
        )
        row["follow_up_on"] = today + timedelta(days=days)
        rows.append(row)
    return rows


def _numbered(rows: list[dict], moment: str) -> list[dict]:
    """In the order they happened, so a newer one has a higher id."""
    rows.sort(key=lambda row: row[moment])
    return [{"id": number, **row} for number, row in enumerate(rows, start=1)]
