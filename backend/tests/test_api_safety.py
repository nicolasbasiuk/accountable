import pytest
from fastapi.testclient import TestClient

from accountable import organizations
from accountable.main import app


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "localhost:5173", "127.0.0.1:8000"])
def test_this_computers_names(api, host):
    assert api.client.get("/api/health", headers={"host": host}).status_code == 200


@pytest.mark.parametrize("host", ["evil.example", "localhost.evil.example", "192.168.1.10", "evil.example:8000", "0.0.0.0"])
def test_another_host_name_is_refused(api, host):
    answer = api.client.get("/api/deals", headers={"host": host})
    assert answer.status_code == 400


@pytest.mark.parametrize("method", ["GET", "POST", "PATCH", "DELETE"])
def test_another_site_gets_no_permission(api, method):
    asked = api.client.options("/api/deals", headers={"origin": "https://evil.example", "access-control-request-method": method})
    assert asked.status_code >= 400
    answer = api.client.get("/api/deals", headers={"origin": "https://evil.example"})
    for response in (asked, answer):
        assert not [name for name in response.headers if name.startswith("access-control")]


@pytest.mark.parametrize("content_type", ["text/plain", "application/x-www-form-urlencoded", None])
def test_a_change_not_sent_as_json_is_refused(api, content_type):
    """Another site's page could send these without asking first."""
    deal = api.deal()
    headers = {"content-type": content_type} if content_type else {}
    for path, body in (
        ("/organizations", '{"name": "A"}'),
        ("/contacts", '{"name": "A"}'),
        ("/deals", '{"name": "A", "value": 1, "close_date": "2026-11-24"}'),
        ("/activities", f'{{"type": "note", "description": "A", "deal_id": {deal}}}'),
        (f"/deals/{deal}/move", '{"stage": "won", "before_id": null}'),
        (f"/deals/{deal}/undo", '{"stage_change_id": 1}'),
    ):
        answer = api.client.post(f"/api{path}", content=body.encode(), headers=headers)
        assert answer.status_code == 422, path
    assert api.get("/organizations") == []
    assert len(api.get("/deals")) == 1
    assert api.get(f"/deals/{deal}")["stage"] == "new"


def test_every_post_needs_a_body():
    """Without one, there'd be no JSON for another site's page to fail to send."""
    posts = {path: methods["post"] for path, methods in app.openapi()["paths"].items() if "post" in methods}
    assert len(posts) == 6
    assert all(post["requestBody"]["required"] for post in posts.values())


def test_config(api):
    """G8, D3"""
    config = api.get("/config")
    assert config["today"] == "2026-11-24"
    assert config["now"].endswith("Z")
    assert [(stage["key"], stage["name"], stage["probability"], stage["open"]) for stage in config["stages"]] == [
        ("new", "New", 10, True),
        ("qualified", "Qualified", 25, True),
        ("proposal", "Proposal", 50, True),
        ("negotiation", "Negotiation", 75, True),
        ("won", "Won", 100, False),
        ("lost", "Lost", 0, False),
    ]


def test_problems_look_the_same(api):
    for answer in (
        api.get("/deals/99", 404),
        api.get("/nothing-here", 404),
        api.post("/deals", {}, 422),
        api.post("/deals/1/undo", {}, 422),
    ):
        assert set(answer) == {"message", "fields"}
        assert answer["message"]


def test_a_failure_on_the_server_says_so_without_details(api, monkeypatch):
    def broken():
        raise RuntimeError("secret detail")

    monkeypatch.setattr(organizations, "list_all", broken)
    answer = TestClient(app, base_url="http://localhost", raise_server_exceptions=False).get("/api/organizations")
    assert answer.status_code == 500
    assert answer.json() == {"message": "Something went wrong on the server.", "fields": {}}
