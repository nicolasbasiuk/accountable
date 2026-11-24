import re
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import APIRouter
from pydantic import AfterValidator, BaseModel

from accountable import organizations, timelines
from accountable.routes.checks import EXACT, OptionalText, RecordId, RequiredText, problem

router = APIRouter(prefix="/api/organizations")


def _website(value: str | None) -> str | None:
    """With or without https://. Nothing but http and https, because it's shown as a link (O1)."""
    if value is None:
        return None
    try:
        address = urlsplit(value if "://" in value else f"https://{value}")
        _ = address.port  # Reading it checks it.
    except ValueError:
        address = None
    if (
        not address
        or re.search(r"\s", value)
        or address.scheme not in ("http", "https")
        or "@" in address.netloc
        or not re.fullmatch(r"[\w-]+(\.[\w-]+)+", address.hostname or "")
    ):
        raise problem("Enter a website address, such as example.com.")
    return value


class OrganizationEdit(BaseModel):
    model_config = EXACT
    name: RequiredText = ""
    website: Annotated[OptionalText, AfterValidator(_website)] = None
    industry: OptionalText = None
    notes: OptionalText = None


class OrganizationAdd(OrganizationEdit):
    name: RequiredText


@router.get("")
def list_organizations():
    return organizations.list_all()


@router.post("", status_code=201)
def add_organization(body: OrganizationAdd):
    return {"id": organizations.add(body.model_dump())}


@router.get("/{organization_id}")
def get_organization(organization_id: RecordId):
    return organizations.get(organization_id)


@router.patch("/{organization_id}")
def edit_organization(organization_id: RecordId, body: OrganizationEdit):
    organizations.edit(organization_id, body.model_dump(exclude_unset=True))
    return {"id": organization_id}


@router.delete("/{organization_id}")
def delete_organization(organization_id: RecordId):
    organizations.delete(organization_id)
    return {"id": organization_id}


@router.get("/{organization_id}/timeline")
def get_timeline(organization_id: RecordId):
    return timelines.for_organization(organization_id)


@router.get("/{organization_id}/deletion")
def get_deletion(organization_id: RecordId):
    return organizations.deletion(organization_id)
