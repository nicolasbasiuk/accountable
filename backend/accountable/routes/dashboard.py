from fastapi import APIRouter

from accountable import dashboard

router = APIRouter(prefix="/api")


@router.get("/dashboard")
def get_dashboard():
    return dashboard.dashboard()
