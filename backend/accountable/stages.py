"""The stages of a deal, in pipeline order. Plain values and functions."""

from datetime import date, timedelta

OPEN = ("new", "qualified", "proposal", "negotiation")
CLOSED = ("won", "lost")
STAGES = OPEN + CLOSED

NAMES = {
    "new": "New",
    "qualified": "Qualified",
    "proposal": "Proposal",
    "negotiation": "Negotiation",
    "won": "Won",
    "lost": "Lost",
}

USUAL_PROBABILITY = {"new": 10, "qualified": 25, "proposal": 50, "negotiation": 75, "won": 100, "lost": 0}

# The Won and Lost columns show the deals closed in this many days (P4).
CLOSED_DAYS = 90


def probability_for(stage: str, given: int | None) -> int:
    """The given probability or the stage's usual one. A closed deal's is fixed (D3)."""
    if stage in CLOSED or given is None:
        return USUAL_PROBABILITY[stage]
    return given


def days_late(stage: str, close_date: date, today: date) -> int:
    """How many days an open deal is past its close date, or 0 (D5)."""
    return max(0, (today - close_date).days) if stage in OPEN else 0


def shown_on_board(stage: str, close_date: date, today: date) -> bool:
    """Every open deal, and the closed ones from the last 90 days (P4)."""
    return stage in OPEN or today - timedelta(days=CLOSED_DAYS) <= close_date <= today
