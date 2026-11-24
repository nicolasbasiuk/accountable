import re
from typing import Annotated, Literal

from fastapi import APIRouter
from pydantic import AfterValidator, BaseModel

from accountable import contacts, timelines
from accountable.routes.checks import EXACT, OptionalText, RecordId, RequiredText, problem
from accountable.tables import STATUSES

router = APIRouter(prefix="/api/contacts")


def _email(value: str | None) -> str | None:
    if value is not None and not re.fullmatch(r"[^@\s]+@[^@\s.]+(\.[^@\s.]+)+", value):
        raise problem("Enter an email address, such as name@example.com.")
    return value


class ContactEdit(BaseModel):
    model_config = EXACT
    name: RequiredText = ""
    email: Annotated[OptionalText, AfterValidator(_email)] = None
    phone: OptionalText = None
    job_title: OptionalText = None
    organization_id: RecordId | None = None
    status: Literal[STATUSES] = "lead"


class ContactAdd(ContactEdit):
    name: RequiredText


@router.get("")
def list_contacts():
    return contacts.list_all()


@router.post("", status_code=201)
def add_contact(body: ContactAdd):
    return {"id": contacts.add(body.model_dump())}


@router.get("/{contact_id}")
def get_contact(contact_id: RecordId):
    return contacts.get(contact_id)


@router.patch("/{contact_id}")
def edit_contact(contact_id: RecordId, body: ContactEdit):
    contacts.edit(contact_id, body.model_dump(exclude_unset=True))
    return {"id": contact_id}


@router.delete("/{contact_id}")
def delete_contact(contact_id: RecordId):
    contacts.delete(contact_id)
    return {"id": contact_id}


@router.get("/{contact_id}/timeline")
def get_timeline(contact_id: RecordId):
    return timelines.for_contact(contact_id)


@router.get("/{contact_id}/deletion")
def get_deletion(contact_id: RecordId):
    return contacts.deletion(contact_id)
