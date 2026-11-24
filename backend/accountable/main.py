"""The app. There's no sign-in, so nothing but this computer's own pages may use it."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.trustedhost import TrustedHostMiddleware

from accountable import errors, seeding
from accountable.routes import activities, contacts, dashboard, deals, general, organizations, pipeline


@asynccontextmanager
async def lifespan(_app: FastAPI):
    seeding.prepare_database()
    yield


app = FastAPI(title="Accountable", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1"])
errors.add_handlers(app)
for area in (general, organizations, contacts, deals, pipeline, activities, dashboard):
    app.include_router(area.router)
