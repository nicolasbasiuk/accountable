from typing import Annotated, Literal

from fastapi import APIRouter
from pydantic import AfterValidator, BaseModel

from accountable import deals, timelines
from accountable.routes.checks import EXACT, Day, RecordId, RequiredText, problem
from accountable.stages import STAGES

router = APIRouter(prefix="/api/deals")

HIGHEST_VALUE = 999_999_999_999


def _value(value: int) -> int:
    if value < 0:
        raise problem("Enter a value of $0 or more.")
    if value > HIGHEST_VALUE:
        raise problem(f"Enter a value of ${HIGHEST_VALUE:,} or less.")
    return value


def _probability(value: int) -> int:
    if not 0 <= value <= 100:
        raise problem("Enter a probability from 0 to 100.")
    return value


Value = Annotated[int, AfterValidator(_value)]


class DealEdit(BaseModel):
    model_config = EXACT
    name: RequiredText = ""
    organization_id: RecordId | None = None
    contact_id: RecordId | None = None
    stage: Literal[STAGES] = "new"
    value: Value = 0
    probability: Annotated[int, AfterValidator(_probability)] = None
    close_date: Day = None


class DealAdd(DealEdit):
    name: RequiredText
    value: Value
    close_date: Day


@router.get("")
def list_deals():
    return deals.list_all()


@router.post("", status_code=201)
def add_deal(body: DealAdd):
    return {"id": deals.add(body.model_dump())}


@router.get("/{deal_id}")
def get_deal(deal_id: RecordId):
    return deals.get(deal_id)


@router.patch("/{deal_id}")
def edit_deal(deal_id: RecordId, body: DealEdit):
    deals.edit(deal_id, body.model_dump(exclude_unset=True))
    return {"id": deal_id}


@router.delete("/{deal_id}")
def delete_deal(deal_id: RecordId):
    deals.delete(deal_id)
    return {"id": deal_id}


@router.get("/{deal_id}/timeline")
def get_timeline(deal_id: RecordId):
    return timelines.for_deal(deal_id)


@router.get("/{deal_id}/deletion")
def get_deletion(deal_id: RecordId):
    return deals.deletion(deal_id)
