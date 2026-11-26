"""The six tables. Column types are portable, for the later move to Postgres."""

from datetime import UTC, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    TypeDecorator,
    and_,
    column,
    or_,
)

from accountable.stages import STAGES

STATUSES = ("lead", "qualified", "customer")
ACTIVITY_TYPES = ("note", "call", "email")

metadata = MetaData()


class UtcDateTime(TypeDecorator):
    """A moment in UTC, to the second. Stored without its time zone, which SQLite can't keep."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        return value and value.astimezone(UTC).replace(tzinfo=None, microsecond=0)

    def process_result_value(self, value: datetime | None, dialect):
        return value and value.replace(tzinfo=UTC)


def one_of(name: str, allowed: tuple[str, ...]) -> CheckConstraint:
    return CheckConstraint(column(name).in_(allowed), name=f"known_{name}")


def percentage(name: str) -> CheckConstraint:
    return CheckConstraint(column(name).between(0, 100), name=f"{name}_is_a_percentage")


def link(target: str, when_deleted: str) -> ForeignKey:
    return ForeignKey(f"{target}.id", ondelete=when_deleted)


organizations = Table(
    "organizations",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String, nullable=False),
    Column("website", String),
    Column("industry", String),
    Column("notes", Text),
)

contacts = Table(
    "contacts",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String, nullable=False),
    Column("email", String),
    Column("phone", String),
    Column("job_title", String),
    Column("status", String, nullable=False),
    Column("organization_id", link("organizations", "SET NULL"), index=True),
    one_of("status", STATUSES),
)

deals = Table(
    "deals",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String, nullable=False),
    Column("organization_id", link("organizations", "SET NULL"), index=True),
    Column("contact_id", link("contacts", "SET NULL"), index=True),
    Column("stage", String, nullable=False),
    Column("value", BigInteger, nullable=False),
    Column("probability", Integer, nullable=False),
    Column("close_date", Date, nullable=False),
    Column("position", Integer, nullable=False),
    one_of("stage", STAGES),
    CheckConstraint(column("value") >= 0, name="value_not_negative"),
    percentage("probability"),
)

activities = Table(
    "activities",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("type", String, nullable=False),
    Column("description", Text, nullable=False),
    Column("happened_at", UtcDateTime, nullable=False),
    Column("follow_up_on", Date),
    Column("done", Boolean, nullable=False, default=False),
    # Where it was logged: exactly one of these two.
    Column("contact_id", link("contacts", "CASCADE"), index=True),
    Column("deal_id", link("deals", "CASCADE"), index=True),
    # On a deal, who its main contact was when it was logged (A5).
    Column("deal_contact_id", link("contacts", "SET NULL"), index=True),
    one_of("type", ACTIVITY_TYPES),
    CheckConstraint(
        or_(
            and_(column("contact_id").is_not(None), column("deal_id").is_(None)),
            and_(column("contact_id").is_(None), column("deal_id").is_not(None)),
        ),
        name="logged_on_one_record",
    ),
)

# Their own table, because the funnel depends on them: they can't be edited or deleted like activities.
stage_changes = Table(
    "stage_changes",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("deal_id", link("deals", "CASCADE"), nullable=False, index=True),
    # Who the deal's main contact was at the time (A5).
    Column("contact_id", link("contacts", "SET NULL"), index=True),
    Column("from_stage", String, nullable=False),
    Column("to_stage", String, nullable=False),
    Column("changed_at", UtcDateTime, nullable=False),
    # What Undo puts back (P8). The status is blank if the move didn't change it.
    Column("from_probability", Integer, nullable=False),
    Column("from_close_date", Date, nullable=False),
    Column("from_position", Integer, nullable=False),
    Column("from_status", String),
    one_of("from_stage", STAGES),
    one_of("to_stage", STAGES),
    percentage("from_probability"),
    CheckConstraint(
        or_(column("from_status").is_(None), column("from_status").in_(STATUSES)), name="known_from_status"
    ),
)

app_info = Table(
    "app_info",
    metadata,
    Column("key", String, primary_key=True),
    Column("value", String, nullable=False),
)
