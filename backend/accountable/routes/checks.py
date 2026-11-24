"""Checks on requests that several records share. The messages for the rest are in errors.py."""

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
    return value.strip() if isinstance(value, str) else value


def _not_blank(value: str) -> str:
    if not value:
        raise PydanticCustomError("missing", "Missing")
    return value


RequiredText = Annotated[str, BeforeValidator(_trim), AfterValidator(_not_blank)]
OptionalText = Annotated[str | None, BeforeValidator(lambda value: _trim(value) or None)]
RecordId = Annotated[int, Field(ge=1, le=LARGEST)]
