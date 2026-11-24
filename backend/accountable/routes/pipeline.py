from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from accountable import pipeline
from accountable.routes.checks import EXACT, RecordId
from accountable.stages import STAGES

router = APIRouter(prefix="/api")


class Move(BaseModel):
    model_config = EXACT
    stage: Literal[STAGES]
    before_id: RecordId | None


class Undo(BaseModel):
    model_config = EXACT
    stage_change_id: RecordId


@router.get("/board")
def get_board():
    return pipeline.board()


@router.post("/deals/{deal_id}/move")
def move_deal(deal_id: RecordId, body: Move):
    return {"stage_change": pipeline.move(deal_id, body.stage, body.before_id)}


@router.post("/deals/{deal_id}/undo")
def undo_move(deal_id: RecordId, body: Undo):
    pipeline.undo(deal_id, body.stage_change_id)
    return {"id": deal_id}
