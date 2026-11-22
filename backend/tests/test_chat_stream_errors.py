import json
import uuid
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from agent.llm import LLMError
from api import chat as api
from services import chat as service


@pytest.fixture
def chat_client(monkeypatch):
    chat_id = uuid.uuid4()
    app = FastAPI()
    app.include_router(api.router)
    app.dependency_overrides[api.get_db] = lambda: Mock()
    app.dependency_overrides[api.owned_session] = lambda: SimpleNamespace(id=chat_id)
    monkeypatch.setattr(service, "_turn_context", lambda _: (uuid.uuid4(), [], {}))
    return TestClient(app), chat_id


def _send(chat_client):
    client, chat_id = chat_client
    response = client.post(f"/api/chat/sessions/{chat_id}/messages", json={"content": "창업 준비 질문"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = []
    for frame in response.text.strip().split("\n\n"):
        event_line, data_line = frame.splitlines()
        events.append((event_line.removeprefix("event: "), json.loads(data_line.removeprefix("data: "))))
    return events


def _answer(*args, **kwargs):
    yield "delta", "답변이 도착했어요."
    yield "done", {"content": "답변이 도착했어요.", "citations": [], "actions": []}


def test_context_error_terminates_the_stream_safely(chat_client, monkeypatch):
    monkeypatch.setattr(service, "_turn_context", Mock(side_effect=RuntimeError("private connection details")))
    persist = Mock()
    monkeypatch.setattr(service, "_persist", persist)

    assert _send(chat_client) == [("error", {"message": service.FAILED})]
    persist.assert_not_called()


def test_provider_configuration_error_is_replaced_with_a_safe_message(chat_client, monkeypatch):
    monkeypatch.setattr(service, "make_llm", Mock(side_effect=LLMError("private provider details")))
    persist = Mock(return_value=True)
    monkeypatch.setattr(service, "_persist", persist)

    [(event, payload)] = _send(chat_client)

    assert event == "error"
    assert payload["message"] == payload["reply"]["content"] == service.FAILED
    assert [row.content for row in persist.call_args.args[3]] == ["창업 준비 질문", service.FAILED]


def test_done_follows_persistence_and_deltas_arrive_first(chat_client, monkeypatch):
    _, chat_id = chat_client
    monkeypatch.setattr(service, "run_turn", _answer)
    persist = Mock(return_value=True)
    monkeypatch.setattr(service, "_persist", persist)

    events = service.ask(chat_id, "질문", llm=object())
    assert next(events) == ("delta", {"text": "답변이 도착했어요."})
    persist.assert_not_called()

    event, payload = next(events)
    assert event == "done"
    assert [(row.role, row.content) for row in persist.call_args.args[3]] == [
        ("user", "질문"), ("assistant", payload["content"]),
    ]
    assert list(events) == []
    persist.assert_called_once()


def test_commit_failure_reports_an_error_after_partial_output(chat_client, monkeypatch):
    # Make the transaction fail after writes and flush have both completed.
    session = Mock()
    session.execute.return_value.rowcount = 1

    @contextmanager
    def failing_transaction():
        yield session
        raise RuntimeError("private transaction details")

    monkeypatch.setattr(service, "make_llm", lambda _: object())
    monkeypatch.setattr(service, "run_turn", _answer)
    monkeypatch.setattr(service, "transaction", failing_transaction)

    assert _send(chat_client) == [
        ("delta", {"text": "답변이 도착했어요."}),
        ("error", {"message": service.SAVE_FAILED}),
    ]
    session.flush.assert_called_once()


def test_closing_a_stream_persists_partial_history(chat_client, monkeypatch):
    _, chat_id = chat_client
    monkeypatch.setattr(service, "run_turn", _answer)
    persist = Mock(return_value=True)
    monkeypatch.setattr(service, "_persist", persist)

    events = service.ask(chat_id, "질문", llm=object())
    assert next(events)[0] == "delta"
    events.close()

    persist.assert_called_once()
    assert [(row.role, row.content) for row in persist.call_args.args[3]] == [("user", "질문")]
