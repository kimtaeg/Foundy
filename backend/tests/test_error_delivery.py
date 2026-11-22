import asyncio
import re

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.testclient import TestClient

from api import errors, health
from config import get_settings
from main import app


def protected_operations():
    for path, methods in app.openapi()["paths"].items():
        resolved_path = re.sub(r"\{[^}]+\}", "00000000-0000-0000-0000-000000000000", path)
        for method, operation in methods.items():
            if operation.get("security"):
                yield pytest.param(method.upper(), resolved_path, id=f"{method.upper()} {path}")


def fail():
    raise RuntimeError("private failure details")


@pytest.mark.parametrize("allowed", [True, False])
def test_unexpected_errors_keep_the_json_contract_and_cors_policy(monkeypatch, allowed):
    monkeypatch.setattr(health, "check_db", fail)
    origin = get_settings().frontend_origins[0] if allowed else "https://untrusted.example.org"
    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/api/health", headers={"Origin": origin})

    assert response.status_code == 500
    assert response.json() == {"error": {"code": "INTERNAL_ERROR", "message": "서버 오류가 발생했습니다."}}
    assert response.headers.get("Access-Control-Allow-Origin") == (origin if allowed else None)


def test_expected_errors_keep_cors_and_original_status():
    origin = get_settings().frontend_origins[0]
    response = TestClient(app).get("/not-found", headers={"Origin": origin})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
    assert response.headers.get("Access-Control-Allow-Origin") == origin


@pytest.mark.parametrize("db", ["ok", "error"])
def test_health_exposes_the_db_status_without_failing_the_probe(monkeypatch, db):
    monkeypatch.setattr(health, "check_db", lambda: db)

    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok", "db": db, "version": health.VERSION, "mock": get_settings().use_mock,
    }


@pytest.mark.parametrize("method,path", list(protected_operations()))
@pytest.mark.parametrize("authorization", [None, "Bearer invalid-token"])
def test_protected_operations_expose_authentication_errors_to_the_frontend(method, path, authorization):
    origin = get_settings().frontend_origins[0]
    headers = {"Origin": origin}
    if authorization:
        headers["Authorization"] = authorization

    response = TestClient(app).request(method, path, headers=headers)

    assert response.status_code == 401
    assert response.json() == {"error": {"code": "UNAUTHORIZED", "message": "로그인이 필요합니다."}}
    assert response.headers.get("Access-Control-Allow-Origin") == origin


def test_stream_failure_does_not_replace_a_started_response():
    stream_app = FastAPI()
    errors.install(stream_app)
    stream_app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"])

    @stream_app.get("/stream")
    def stream():
        async def events():
            yield "data: ready\n\n"
            fail()

        return StreamingResponse(events(), media_type="text/event-stream")

    sent = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"}, "http_version": "1.1",
             "method": "GET", "scheme": "http", "path": "/stream", "root_path": "", "query_string": b"",
             "headers": [(b"origin", b"http://localhost:3000")]}
    with pytest.raises(RuntimeError, match="private failure details"):
        asyncio.run(stream_app(scope, receive, send))

    assert [message["type"] for message in sent] == ["http.response.start", "http.response.body"]
    assert sent[0]["status"] == 200
    assert dict(sent[0]["headers"])[b"access-control-allow-origin"] == b"http://localhost:3000"
    assert sent[1]["body"] == b"data: ready\n\n"
