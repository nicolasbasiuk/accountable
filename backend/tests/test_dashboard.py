from datetime import date

import pytest


def funnel(api) -> dict[str, tuple[int, int]]:
    return {row["stage"]: (row["deals"], row["value"]) for row in api.get("/dashboard")["funnel"]}


def reached(api) -> list[str]:
    """The stages the only deal there is counts at."""
    return [stage for stage, (deals, _) in funnel(api).items() if deals]


# Figures (B1)


def test_figures(api):
    api.deal(value=10_000, probability=15)
    api.deal(value=20_001, probability=50)
    api.deal(value=40_000, stage="won", close_date="2026-11-24")
    api.deal(value=5_000, stage="won", close_date="2026-11-01")
    api.deal(value=7_000, stage="won", close_date="2026-10-31")
    api.deal(value=99_000, stage="lost", close_date="2026-11-10")
    figures = api.get("/dashboard")["figures"]
    assert figures["won_this_month"] == {"value": 45_000, "deals": 2}
    assert figures["won_12_months"] == {"value": 52_000, "deals": 3}
    assert figures["open"] == {"value": 30_001, "deals": 2}
    assert figures["expected"] == pytest.approx(1_500 + 10_000.5)


def test_nothing_at_all(api):
    answer = api.get("/dashboard")
    nothing = {"value": 0, "deals": 0}
    assert answer["figures"] == {"won_this_month": nothing, "won_12_months": nothing, "open": nothing, "expected": 0}
    assert [(month["value"], month["deals"]) for month in answer["months"]] == [(0, 0)] * 12
    assert [(row["deals"], row["value"], row["share"]) for row in answer["funnel"]] == [(0, 0, None)] * 5
    assert (answer["follow_ups"], answer["recent"], answer["overdue"], answer["late"]) == ([], [], 0, 0)


# Months (B2)


def test_twelve_months(api):
    api.deal(value=1_000, stage="won", close_date="2025-12-01")
    api.deal(value=99_000, stage="won", close_date="2025-11-30")
    api.deal(value=2_000, stage="won", close_date="2026-11-24")
    api.deal(value=3_000, stage="won", close_date="2026-02-28")
    api.deal(value=4_000, stage="won", close_date="2026-02-01")
    months = api.get("/dashboard")["months"]
    assert [month["month"] for month in months] == [
        "2025-12-01",
        "2026-01-01",
        "2026-02-01",
        "2026-03-01",
        "2026-04-01",
        "2026-05-01",
        "2026-06-01",
        "2026-07-01",
        "2026-08-01",
        "2026-09-01",
        "2026-10-01",
        "2026-11-01",
    ]
    assert [(month["value"], month["deals"]) for month in months] == [(1_000, 1), (0, 0), (7_000, 2)] + [(0, 0)] * 8 + [
        (2_000, 1)
    ]


@pytest.mark.parametrize(
    "day, first, last",
    [
        (date(2026, 1, 1), "2025-02-01", "2026-01-01"),
        (date(2026, 12, 31), "2026-01-01", "2026-12-01"),
        (date(2028, 2, 29), "2027-03-01", "2028-02-01"),
    ],
)
def test_months_at_the_ends_of_a_year(api, on_day, day, first, last):
    on_day(day)
    months = [month["month"] for month in api.get("/dashboard")["months"]]
    assert (months[0], months[-1], len(months)) == (first, last, 12)


def test_only_deals_that_are_won_now(api):
    deal = api.deal(value=8_000)
    api.move(deal, "won")
    assert api.get("/dashboard")["months"][-1]["deals"] == 1
    api.move(deal, "proposal")
    assert api.get("/dashboard")["months"][-1]["deals"] == 0


# Pipeline by stage (B3)


def test_by_stage(api):
    api.deal(value=10_000, probability=10)
    api.deal(value=5_001, probability=33)
    api.deal(value=20_000, stage="negotiation")
    api.deal(value=99_000, stage="won")
    rows = {row["stage"]: row for row in api.get("/dashboard")["stages"]}
    assert list(rows) == ["new", "qualified", "proposal", "negotiation"]
    assert (rows["new"]["deals"], rows["new"]["value"]) == (2, 15_001)
    assert rows["new"]["expected"] == pytest.approx(2650.33)
    assert (rows["qualified"]["value"], rows["qualified"]["expected"]) == (0, 0)
    assert rows["negotiation"]["expected"] == 15_000


# Funnel (B4)


@pytest.mark.parametrize(
    "stage, expected",
    [
        ("new", ["new"]),
        ("qualified", ["new", "qualified"]),
        ("proposal", ["new", "qualified", "proposal"]),
        ("negotiation", ["new", "qualified", "proposal", "negotiation"]),
        ("won", ["new", "qualified", "proposal", "negotiation", "won"]),
        ("lost", ["new"]),
    ],
)
def test_added_at_a_stage(api, stage, expected):
    api.deal(stage=stage)
    assert reached(api) == expected


def test_an_open_deal_that_moved_back_counts_at_the_furthest(api):
    deal = api.deal()
    api.move(deal, "proposal")
    api.move(deal, "new")
    assert reached(api) == ["new", "qualified", "proposal"]


def test_a_deal_added_further_along_and_moved_back(api):
    """The stage it started at is only in the change's first end."""
    deal = api.deal(stage="negotiation")
    api.move(deal, "qualified")
    assert reached(api) == ["new", "qualified", "proposal", "negotiation"]


def test_a_reopened_deal_does_not_count_as_won(api):
    deal = api.deal(stage="qualified")
    api.move(deal, "won")
    api.move(deal, "proposal")
    assert reached(api) == ["new", "qualified", "proposal"]


@pytest.mark.parametrize(
    "stage, expected",
    [
        ("new", ["new"]),
        ("qualified", ["new", "qualified"]),
        ("proposal", ["new", "qualified", "proposal"]),
        ("negotiation", ["new", "qualified", "proposal", "negotiation"]),
        ("won", ["new", "qualified", "proposal", "negotiation"]),
    ],
)
def test_a_lost_deal_counts_up_to_where_it_was_lost_from(api, stage, expected):
    deal = api.deal(stage=stage)
    api.move(deal, "lost")
    assert reached(api) == expected


def test_a_lost_deal_that_had_moved_back_first(api):
    deal = api.deal(stage="negotiation")
    api.move(deal, "new")
    api.move(deal, "lost")
    assert reached(api) == ["new"]


def test_lost_twice_counts_the_latest(api):
    deal = api.deal(stage="negotiation")
    api.move(deal, "lost")
    api.move(deal, "qualified")
    api.move(deal, "lost")
    assert reached(api) == ["new", "qualified"]


@pytest.mark.parametrize("stage", ["won", "lost"])
@pytest.mark.parametrize("close_date, counts", [("2025-12-01", True), ("2025-11-30", False)])
def test_closed_before_the_12_months(api, stage, close_date, counts):
    api.deal(stage=stage, close_date=close_date)
    assert bool(reached(api)) is counts


def test_open_deals_count_however_old(api):
    api.deal(close_date="2020-01-01")
    assert reached(api) == ["new"]


def test_values_and_shares(api):
    api.deal(value=30_000)
    api.deal(value=20_000, stage="qualified")
    api.deal(value=50_000, stage="won")
    rows = api.get("/dashboard")["funnel"]
    assert [(row["deals"], row["value"]) for row in rows] == [
        (3, 100_000),
        (2, 70_000),
        (1, 50_000),
        (1, 50_000),
        (1, 50_000),
    ]
    assert [row["share"] for row in rows] == [None, pytest.approx(0.7), pytest.approx(5 / 7), 1, 1]


def test_a_share_of_nothing(api):
    api.deal(value=0, stage="won")
    assert [row["share"] for row in api.get("/dashboard")["funnel"]] == [None] * 5


def test_won_in_the_funnel_equals_the_12_months_revenue(sample):
    """B2, B4"""
    answer = sample.get("/dashboard")
    won = answer["funnel"][-1]
    assert (won["value"], won["deals"]) == (
        sum(month["value"] for month in answer["months"]),
        sum(month["deals"] for month in answer["months"]),
    )
    assert won["value"] == answer["figures"]["won_12_months"]["value"]


def test_the_figures_add_up_to_the_deals(sample):
    """B7"""
    answer, deals = sample.get("/dashboard"), sample.get("/deals")
    open_deals = [deal for deal in deals if deal["stage"] not in ("won", "lost")]
    assert answer["figures"]["open"] == {"value": sum(deal["value"] for deal in open_deals), "deals": len(open_deals)}
    assert answer["figures"]["expected"] == pytest.approx(sum(deal["expected_revenue"] for deal in open_deals))
    assert answer["late"] == len([deal for deal in deals if deal["days_late"]]) == 4
    assert sum(row["value"] for row in answer["stages"]) == answer["figures"]["open"]["value"]
    assert answer["funnel"][0]["deals"] == 96


# Follow-ups (B5)


def test_follow_ups(api):
    contact = api.contact()
    due = {
        name: api.activity(name, contact_id=contact, follow_up_on=day)
        for name, day in {
            "In 14 days": "2026-12-08",
            "In 15 days": "2026-12-09",
            "Today": "2026-11-24",
            "Yesterday": "2026-11-23",
            "Long ago": "2026-01-05",
            "Tomorrow": "2026-11-25",
        }.items()
    }
    done = api.activity("Done", contact_id=contact, follow_up_on="2026-11-24")
    api.patch(f"/activities/{done}", {"done": True})
    api.activity("No follow-up", contact_id=contact)

    answer = api.get("/dashboard")
    assert [entry["description"] for entry in answer["follow_ups"]] == [
        "Long ago",
        "Yesterday",
        "Today",
        "Tomorrow",
        "In 14 days",
    ]
    assert answer["overdue"] == 2
    assert answer["follow_ups"][0]["record"]["name"] == "Priya Nair"

    api.patch(f"/activities/{due['Long ago']}", {"done": True})
    assert api.get("/dashboard")["overdue"] == 1
    api.patch(f"/activities/{due['Long ago']}", {"done": False})
    assert api.get("/dashboard")["overdue"] == 2


# Recent activity (B6)


def test_the_newest_10_entries_each_once(api):
    organization = api.organization()
    contact = api.contact(organization_id=organization)
    deal = api.deal(organization_id=organization, contact_id=contact)
    logged = [api.activity(f"Call {n}", deal_id=deal, happened_at=f"2026-11-{n:02d}T10:00:00Z") for n in range(1, 13)]
    change = api.move(deal, "qualified")
    recent = api.get("/dashboard")["recent"]
    assert [(entry["kind"], entry["id"]) for entry in recent] == [("stage_change", change["id"])] + [
        ("activity", one) for one in logged[:2:-1]
    ]
    assert len(recent) == 10
