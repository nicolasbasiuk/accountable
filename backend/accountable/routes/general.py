from fastapi import APIRouter

from accountable import clock, stages

router = APIRouter(prefix="/api")


@router.get("/config")
def get_config():
    return {
        "today": clock.today(),
        "now": clock.as_text(clock.now()),
        "stages": [
            {"key": key, "name": stages.NAMES[key], "probability": stages.USUAL_PROBABILITY[key], "open": key in stages.OPEN}
            for key in stages.STAGES
        ],
    }


@router.get("/health")
def get_health():
    return {"app": "accountable", "ready": True}
