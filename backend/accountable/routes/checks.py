"""Checks on requests that several records share. The messages for the rest are in errors.py."""

from datetime import date
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator, ConfigDict, Field
from pydantic_core import PydanticCustomError

# The highest whole number that a browser can keep exactly.
LARGEST = 2**53 - 1

# Nothing but the fields listed: an unknown one, such as an activity's record, is refused.
EXACT = ConfigDict(extra="forbid")


def problem(message: str) -> PydanticCustomError:
    return PydanticCustomError("plain", message)


def _trim(value):
    if not isinstance(value, str):
        return value
    try:
        value.encode()
    except UnicodeEncodeError:  # Half of a character, which JSON can hold and a database can't.
        raise problem("This has a character that can't be saved.") from None
    return value.strip()


def _not_blank(value: str) -> str:
    if not value:
        raise PydanticCustomError("missing", "Missing")
    return value


def full_year(value: date) -> date:
    """For a date, or a date and time. A browser makes 0026 of a year typed as 26."""
    if value.year < 1000:
        raise problem("Enter the year with four digits, such as 2026.")
    return value


RequiredText = Annotated[str, BeforeValidator(_trim), AfterValidator(_not_blank)]
OptionalText = Annotated[str | None, BeforeValidator(lambda value: _trim(value) or None)]
RecordId = Annotated[int, Field(ge=1, le=LARGEST)]
Day = Annotated[date, AfterValidator(full_year)]
