"""The only place that reads the clock, so tests can fix the day."""

from datetime import UTC, date, datetime

from accountable import settings


def today() -> date:
    """The server's local date (G8)."""
    return settings.fixed_today() or date.today()


def now() -> datetime:
    """This moment in UTC. With a fixed day, that day at the real time of day."""
    moment = datetime.now().replace(microsecond=0)
    return datetime.combine(today(), moment.time()).astimezone(UTC)


def as_text(moment: datetime | None) -> str | None:
    """How times leave the API."""
    return moment and moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
