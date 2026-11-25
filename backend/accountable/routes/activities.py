from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter
from pydantic import AfterValidator, AwareDatetime, BaseModel, model_validator

from accountable import activities
from accountable.errors import Invalid
from accountable.routes.checks import EXACT, Day, RecordId, RequiredText, full_year, problem
from accountable.tables import ACTIVITY_TYPES

router = APIRouter(prefix="/api/activities")


def _in_utc(value: datetime) -> datetime:
    try:
        return value.astimezone(UTC)
    except OverflowError:  # In UTC it would be after the last year.
        raise problem("Enter a date and time.") from None


Moment = Annotated[AwareDatetime, AfterValidator(full_year), AfterValidator(_in_utc)]


class ActivityEdit(BaseModel):
    """The record it was logged on isn't here, so it can't be changed (A2)."""

    model_config = EXACT
    type: Literal[ACTIVITY_TYPES] = "note"
    description: RequiredText = ""
    happened_at: Moment = None
    follow_up_on: Day | None = None
    done: bool = False


class ActivityAdd(BaseModel):
    model_config = EXACT
    type: Literal[ACTIVITY_TYPES]
    description: RequiredText
    happened_at: Moment | None = None
    follow_up_on: Day | None = None
    contact_id: RecordId | None = None
    deal_id: RecordId | None = None

    @model_validator(mode="after")
    def on_one_record(self):
        if (self.contact_id is None) == (self.deal_id is None):
            raise Invalid({"deal_id": "Choose a contact or a deal."})
        return self


@router.post("", status_code=201)
def add_activity(body: ActivityAdd):
    return {"id": activities.add(body.model_dump())}


@router.patch("/{activity_id}")
def edit_activity(activity_id: RecordId, body: ActivityEdit):
    activities.edit(activity_id, body.model_dump(exclude_unset=True))
    return {"id": activity_id}


@router.delete("/{activity_id}")
def delete_activity(activity_id: RecordId):
    activities.delete(activity_id)
    return {"id": activity_id}
