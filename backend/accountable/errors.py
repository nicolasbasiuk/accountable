"""Problems the API reports, all as {message, fields}."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException


class NotFound(Exception):
    message = "This record doesn't exist. It may have been deleted."


class Conflict(Exception):
    """The request no longer fits what's saved."""

    def __init__(self, message: str):
        self.message = message


class Invalid(Exception):
    """Fields that need another value, each with a message."""

    message = "Some of this can't be saved as it is."

    def __init__(self, fields: dict[str, str]):
        self.fields = fields


def add_handlers(app: FastAPI) -> None:
    app.add_exception_handler(NotFound, lambda _request, error: _answer(404, error.message))
    app.add_exception_handler(Conflict, lambda _request, error: _answer(409, error.message))
    app.add_exception_handler(Invalid, lambda _request, error: _answer(422, error.message, error.fields))
    app.add_exception_handler(RequestValidationError, _failed_checks)
    app.add_exception_handler(HTTPException, lambda _request, error: _answer(error.status_code, str(error.detail)))
    app.add_exception_handler(Exception, lambda _request, _error: _answer(500, "Something went wrong on the server."))


def _answer(status: int, message: str, fields: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse({"message": message, "fields": fields or {}}, status_code=status)


def _failed_checks(_request: Request, error: RequestValidationError) -> JSONResponse:
    if any(problem["loc"][0] == "path" for problem in error.errors()):
        return _answer(404, NotFound.message)  # An address with an impossible id.
    fields = {}
    for problem in error.errors():
        if len(problem["loc"]) > 1:
            fields.setdefault(str(problem["loc"][1]), _explain(problem))
    return _answer(422, Invalid.message, fields)


# The start of Pydantic's name for a problem, and what to say about it.
_EXPLANATIONS = {
    "int": "Enter a whole number.",
    "date": "Enter a date.",
    "timezone": "Enter a date and time.",
    "literal": "Choose one of the options.",
    "extra": "This can't be changed.",
    "greater": "Choose one from the list.",
    "less": "Choose one from the list.",
}


def _explain(problem: dict) -> str:
    if problem["type"] == "plain":
        return problem["msg"]
    if problem["type"] == "missing" or problem.get("input") is None:
        label = str(problem["loc"][1]).removesuffix("_id").replace("_", " ")
        return f"Enter {'an' if label[0] in 'aeiou' else 'a'} {label}."
    start = problem["type"].split("_")[0].replace("datetime", "date")
    return _EXPLANATIONS.get(start, "Enter another value.")
