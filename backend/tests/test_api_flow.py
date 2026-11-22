"""데모 흐름 API 통합 테스트. 실제 DB(DATABASE_URL)가 있을 때만 실행하고, 만든 예시 계정은 끝나면 지운다.

시드(seoyeon.json) 기준 키: r-01 building_use(선택지 o-1 술 빼고 / o-2 용도변경→x-1),
r-03 building_violation, r-02 trademark_similar. c-01 은 r-01·r-03 둘 다 완료되면 자동 체크.
"""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

from config import get_settings

pytestmark = pytest.mark.skipif(not get_settings().database_url, reason="DATABASE_URL 이 없어 DB 테스트를 건너뜁니다")

DOCS = Path(__file__).resolve().parents[2] / "docs"
SCHEMAS = {n: json.loads((DOCS / f"{n}-schema.json").read_text()) for n in ("report", "checklist")}
REGISTRY = Registry().with_resources((s["$id"], Resource.from_contents(s)) for s in SCHEMAS.values())


def validate(name: str, payload: dict) -> None:
    Draft202012Validator(SCHEMAS[name], registry=REGISTRY, format_checker=FormatChecker()).validate(payload)


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from agent.loop import run_analysis
    from main import app
    from tests.fakes import SIMILAR, FakeTools
    from tests.test_loop import llm

    with TestClient(app) as c, pytest.MonkeyPatch.context() as mp:
        # 선택·수정으로 시작되는 재분석이 실제 외부 API·LLM을 부르지 않게 한다
        manager = app.state.analysis_manager
        mp.setattr(manager, "dependencies", lambda cost: (FakeTools(similar=SIMILAR), llm()))
        mp.setattr(manager, "runner", run_analysis)
        yield c


@pytest.fixture(scope="module")
def created_users():
    users: list[str] = []
    yield users
    from sqlalchemy import delete

    from db.models import User
    from db.session import transaction

    with transaction() as s:
        s.execute(delete(User).where(User.id.in_(users), User.provider == "demo"))


@pytest.fixture
def demo(client, created_users):
    res = client.post("/api/demo")
    assert res.status_code == 201
    body = res.json()
    created_users.append(body["user"]["user_id"])
    sid = body["store_id"]
    headers = {"Authorization": f"Bearer {body['access_token']}"}

    def call(method: str, path: str = "", **kw):
        return client.request(method, f"/api/stores/{sid}{path}", headers=headers, **kw)

    call.store_id, call.headers, call.body = sid, headers, body
    return call


def checklist_items(demo) -> dict:
    res = demo("GET", "/checklist")
    assert res.status_code == 200
    validate("checklist", res.json())
    return {i["item_id"]: i for g in res.json()["groups"] for i in g["items"]}


def alert_keys(demo, type_: str) -> list[str]:
    return [a["cta"]["item_id"] for a in demo("GET", "/alerts", params={"type": type_}).json()["items"]]


def test_1_demo_dashboard(demo, client):
    assert demo.body["run_id"] and demo.body["cached"] is True
    me = client.get("/api/me", headers=demo.headers).json()
    assert me["store_id"] == demo.store_id and me["user"]["provider"] == "demo"

    dash = demo("GET", "/dashboard").json()
    assert [p["item_id"] for p in dash["pending_decisions"]] == ["r-01", "r-02"]
    assert dash["pending_decisions"][0]["stage"] == "계약 전"
    assert dash["checklist_progress"] == {"done": 2, "total": 9}
    assert dash["alerts"]["unread"] == 2
    assert 1 <= len(dash["next_steps"]) <= 5

    report = demo("GET", "/report")
    assert report.status_code == 200
    validate("report", report.json())
    assert report.json()["next_steps"] == dash["next_steps"]
    first = report.json()["groups"][0]["items"][0]
    assert first["item_id"] == "r-01" and first["verdict"] == "high"  # 위험한 것부터
    operating = demo("GET", "/report", params={"stage": "운영 중"}).json()
    assert [i["item_id"] for i in operating["groups"][0]["items"]] == ["r-05"]
    assert first["contact"]["agency"] == "성동구청 건축과"
    assert first["contact"]["is_example"] is True

    store = demo("GET").json()
    assert store["answers"]["sells_alcohol"] is True and store["effective"]["business_type"] == "일반음식점"
    docs = demo("GET", "/documents").json()
    # 서류 진행률은 서류 자신의 상태로 센다: 체크리스트 항목이 완료돼 있어도 서류를 준비하기 전이면 0이다
    assert (docs["summary"]["total"], docs["summary"]["finished"], docs["summary"]["remaining"]) == (8, 0, 8)
    assert dash["documents_progress"] == {"finished": 0, "total": 8}
    assert all(d["links"] for g in docs["groups"] for d in g["documents"] if d["source_type"] == "template")  # 법령 규칙 서류는 링크 없이 받는 곳만 안내
    tasks = checklist_items(demo)
    assert {row["item_id"] for row in dash["checklist_tasks"]} == set(tasks)
    for group in docs["groups"]:
        task = tasks[group["item_id"]]
        assert group["task"] == task["task"] and group["category"] == task["category"]
        assert sorted(d["name"] for d in group["documents"]) == task["document_names"]


def test_grant_refresh_reuses_only_unchanged_successful_judgments(demo, monkeypatch):
    from agent.grants import Condition, GrantExtraction
    from agent.llm import LLMError
    from agent.ports import ToolResult
    from api import grants

    source, title, excerpt = "K-Startup", "창업 지원", "만 39세 이하 창업자"
    notice = {"grant_id": "k-1", "title": title, "source": source, "text": excerpt, "deadline": "2099-01-12"}
    source_available, model_available, calls = True, True, []

    class Tools:
        use_mock = False

        def grants(self, _store):
            data = {"grants": [notice.copy()]} if source_available else None
            return ToolResult(ok=source_available, source=source, data=data, error=None if data else "조회 실패")

        def close(self):
            pass

    class Model:
        def parse(self, **kwargs):
            calls.append(kwargs["user"])
            if not model_available:
                raise LLMError("temporary")
            return GrantExtraction(conditions=[
                Condition(kind="age_max", text="최대 연령", quote=excerpt, number=39),
            ])

    monkeypatch.setattr(grants, "make_dependencies", lambda _cost: (Tools(), Model()))

    def refresh():
        response = demo("POST", "/grants/refresh")
        assert response.status_code == 200
        return response.json()

    empty = demo("GET", "/grants")
    assert empty.status_code == 200
    assert empty.json()["status"] == "empty" and empty.json()["items"] == []
    first = refresh()
    assert first["items"][0]["title"] == title
    assert "judgment_key" not in str(first)
    assert demo("GET", "/grants").json() == first
    assert refresh() == first
    assert len(calls) == 1

    source_available = False
    assert refresh() == {**first, "error": "조회 실패"}
    assert demo("GET", "/grants").json() == first
    assert len(calls) == 1
    source_available = True

    notice["text"] += " · 상세 안내 수정"
    model_available = False
    assert refresh()["items"][0]["result"] == "unknown"
    assert len(calls) == 2
    model_available = True
    retried = refresh()
    assert retried["items"][0]["checks"][0]["evidence"]["text"] == excerpt
    assert refresh() == retried
    assert len(calls) == 3


def test_chat_session_stream_history_and_ownership(demo, client, created_users, monkeypatch):
    from services import chat

    def fake_turn(model, **inputs):
        assert model is not None
        assert inputs["question"] == "개업일이 언제인가요?"
        yield "delta", "개업 예정일은 "
        yield "done", {"content": "개업 예정일은 2027년 3월 2일입니다.", "actions": [], "citations": []}

    monkeypatch.setattr(chat, "make_llm", lambda cost: object())
    monkeypatch.setattr(chat, "run_turn", fake_turn)
    base = "/api/chat/sessions"
    store = {"store_id": demo.store_id}
    headers = demo.headers

    assert client.get(base, headers=headers, params={**store, "include_messages": True}).json() == {
        "items": [], "messages": [],
    }
    response = client.post(base, headers=headers, json=store)
    assert response.status_code == 201
    session = response.json()
    assert session["store_id"] == demo.store_id
    assert client.get(base, headers=headers, params=store).json() == {"items": [session]}
    session_path = f"{base}/{session['session_id']}"
    messages_path = f"{session_path}/messages"

    other = client.post("/api/demo")
    assert other.status_code == 201
    other_body = other.json()
    created_users.append(other_body["user"]["user_id"])
    other_headers = {"Authorization": f"Bearer {other_body['access_token']}"}
    assert client.post(base, headers=other_headers, json=store).status_code == 403
    assert client.get(base, headers=other_headers, params=store).status_code == 403
    assert client.get(messages_path, headers=other_headers).status_code == 404
    assert client.post(messages_path, headers=other_headers, json={"content": "안녕하세요"}).status_code == 404
    assert client.delete(session_path, headers=other_headers).status_code == 404

    invalid = client.post(messages_path, headers=headers, json={"content": ""})
    assert invalid.status_code == 400 and invalid.json()["error"]["code"] == "INVALID_INPUT"
    stream = client.post(messages_path, headers=headers, json={"content": "개업일이 언제인가요?"})
    assert stream.status_code == 200 and stream.headers["Content-Type"].startswith("text/event-stream")
    assert "event: delta" in stream.text and "event: done" in stream.text
    assert "개업 예정일은 2027년 3월 2일입니다." in stream.text

    def failed_turn(*args, **kwargs):
        raise RuntimeError("test provider error")

    monkeypatch.setattr(chat, "run_turn", failed_turn)
    failed = client.post(messages_path, headers=headers, json={"content": "다시 물어볼게요"})
    assert failed.status_code == 200
    assert "event: error" in failed.text and chat.FAILED in failed.text
    assert "test provider error" not in failed.text
    history = client.get(messages_path, headers=headers)
    assert history.status_code == 200
    messages = history.json()["items"]
    assert [(message["role"], message["content"]) for message in messages] == [
        ("user", "개업일이 언제인가요?"), ("assistant", "개업 예정일은 2027년 3월 2일입니다."),
        ("user", "다시 물어볼게요"), ("assistant", chat.FAILED),
    ]
    summary = client.get(base, headers=headers, params={**store, "include_messages": True}).json()
    assert summary["messages"] == messages and summary["items"][0]["title"] == "개업일이 언제인가요?"
    assert client.delete(session_path, headers=headers).status_code == 204
    assert client.get(messages_path, headers=headers).json()["error"]["code"] == "CHAT_SESSION_NOT_FOUND"
    assert client.get(base, headers=headers, params=store).json() == {"items": []}


def test_2_choose_drop_alcohol(demo):
    res = demo("POST", "/report/items/r-01/choose", json={"option_id": "o-1"})
    assert res.status_code == 200
    body = res.json()
    assert body["chosen_option"] == "o-1" and body["applied"] == ["sells_alcohol"]
    assert any("휴게음식점" in line for line in body["applied_changes"])

    eff = demo("GET").json()["effective"]
    assert eff["answers"]["sells_alcohol"] is False and eff["business_type"] == "휴게음식점"
    assert "r-01" not in alert_keys(demo, "decision")
    assert checklist_items(demo)["c-04"]["task"].startswith("휴게음식점")


def test_3_choose_adds_and_switch_removes_extra_task(demo):
    decision = next(alert for alert in demo("GET", "/alerts").json()["items"]
                    if alert["type"] == "decision" and alert["cta"]["item_id"] == "r-01")
    body = demo("POST", "/report/items/r-01/choose", json={"option_id": "o-2"}).json()
    assert body["added_checklist"] == ["x-1"]
    assert body["alerts_update"] == {"removed_ids": [decision["alert_id"]], "added": None}
    report = demo("GET", "/report").json()
    assert body["report_update"] == {key: report[key] for key in ("summary", "groups", "next_steps")}
    items = checklist_items(demo)
    assert items["x-1"]["source"] == "report" and items["x-1"]["report_item_ids"] == ["r-01"]
    assert items["x-1"]["documents"] == []  # 문의 항목에는 규칙에 등록된 서류가 없다.
    assert items["x-1"]["contact"]["agency"] == "성동구청 건축과"

    repeated = demo("POST", "/report/items/r-01/choose", json={"option_id": "o-2"})
    assert repeated.status_code == 200
    assert len([i for i in checklist_items(demo) if i == "x-1"]) == 1

    other_site = demo("POST", "/report/items/r-01/choose", json={"option_id": "o-3"})
    assert other_site.status_code == 200 and other_site.json()["added_checklist"] == ["x-0"]
    items = checklist_items(demo)
    assert "x-0" in items and "x-1" not in items
    assert items["x-0"]["documents"][0]["links"]

    demo("POST", "/report/items/r-01/choose", json={"option_id": "o-1"})
    assert not {"x-0", "x-1"}.intersection(checklist_items(demo))

    bad = demo("POST", "/report/items/r-01/choose", json={"option_id": "o-9"})
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "INVALID_INPUT"


def test_4_auto_check_needs_all_linked_cards(demo):
    r1 = demo("POST", "/report/items/r-01/action", json={"status": "done"}).json()
    assert r1["auto_checked"] == [] and r1["next_steps"]
    r2 = demo("POST", "/report/items/r-03/action", json={"status": "done", "reply": "구청 답변 받음"}).json()
    assert r2["auto_checked"] == ["c-01"]
    report = demo("GET", "/report").json()
    assert r2["report_update"] == {key: report[key] for key in ("summary", "groups", "next_steps")}
    assert r2["alerts_update"]["added"] in demo("GET", "/alerts").json()["items"]
    c01 = checklist_items(demo)["c-01"]
    assert c01["done"] and c01["auto_checked"]
    assert "r-03" in alert_keys(demo, "next")

    reverted = demo("POST", "/report/items/r-03/action", json={"status": "pending"}).json()
    assert reverted["alerts_update"] == {"removed_ids": [r2["alerts_update"]["added"]["alert_id"]], "added": None}
    c01 = checklist_items(demo)["c-01"]
    assert not c01["done"] and not c01["auto_checked"]
    assert "r-03" not in alert_keys(demo, "next")


def test_5_manual_check_survives_card_revert(demo):
    res = demo("PATCH", "/checklist/c-01", json={"done": True})
    assert res.status_code == 200 and res.json()["done"] and not res.json()["auto_checked"]
    demo("POST", "/report/items/r-01/action", json={"status": "done"})
    demo("POST", "/report/items/r-03/action", json={"status": "done"})
    demo("POST", "/report/items/r-03/action", json={"status": "pending"})
    assert checklist_items(demo)["c-01"]["done"]


def test_6_auth_and_errors(demo, client, created_users):
    other = client.post("/api/demo").json()
    created_users.append(other["user"]["user_id"])
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    forbidden = client.get(f"/api/stores/{demo.store_id}/dashboard", headers=other_headers)
    assert forbidden.status_code == 403 and forbidden.json()["error"]["code"] == "FORBIDDEN"
    assert client.get(f"/api/stores/{demo.store_id}/dashboard").status_code == 401
    assert client.get(f"/api/stores/{demo.store_id}/dashboard", headers={"Authorization": "Bearer x"}).status_code == 401
    missing = client.get("/api/stores/00000000-0000-0000-0000-000000000000", headers=demo.headers)
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "STORE_NOT_FOUND"
    assert demo("POST", "/report/items/r-99/action", json={"status": "done"}).status_code == 404
    invalid = demo("POST", "/report/items/r-01/action", json={"status": "finished"})
    assert invalid.status_code == 400 and invalid.json()["error"]["code"] == "INVALID_INPUT"


def test_7_alert_read(demo):
    items = demo("GET", "/alerts").json()["items"]
    res = demo("PATCH", f"/alerts/{items[0]['alert_id']}", json={"read": True})
    assert res.status_code == 200 and res.json()["read"] is True
    assert demo("GET", "/dashboard").json()["alerts"]["unread"] == len(items) - 1
    assert demo("PATCH", "/alerts/not-a-uuid", json={"read": True}).status_code == 404


def test_8_each_card_completes_its_own_checklist_item(demo):
    for card_id, task_id in [("r-02", "c-02"), ("r-04", "c-04")]:
        done = demo("POST", f"/report/items/{card_id}/action", json={"status": "done"})
        assert done.status_code == 200 and done.json()["auto_checked"] == [task_id]
        assert checklist_items(demo)[task_id]["auto_checked"]
        reverted = demo("POST", f"/report/items/{card_id}/action", json={"status": "pending"})
        assert reverted.status_code == 200
        assert not checklist_items(demo)[task_id]["done"]


def test_9_account_changes_do_not_affect_another_demo(demo, client, created_users):
    other = client.post("/api/demo")
    assert other.status_code == 201
    body = other.json()
    created_users.append(body["user"]["user_id"])
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    base = f"/api/stores/{body['store_id']}"
    before_report = client.get(base + "/report", headers=headers).json()
    before_checklist = client.get(base + "/checklist", headers=headers).json()

    assert demo("POST", "/report/items/r-01/choose", json={"option_id": "o-2"}).status_code == 200
    assert demo("PATCH", "/checklist/c-01", json={"done": True}).status_code == 200

    assert client.get(base + "/report", headers=headers).json() == before_report
    assert client.get(base + "/checklist", headers=headers).json() == before_checklist


def test_10_unknown_region_returns_contact_fallback(demo):
    import uuid
    from db.models import Store
    from db.session import transaction

    with transaction() as session:
        store = session.get(Store, uuid.UUID(demo.store_id))
        store.address_codes = {"sigungu_cd": "99999"}

    report = demo("GET", "/report")
    validate("report", report.json())
    card = report.json()["groups"][0]["items"][0]
    assert card["contact"]["phone"] == "110" and not card["contact"]["is_example"]
    assert card["contact"]["tip"]
    assert checklist_items(demo)["c-01"]["contact"]["phone"] == "110"


def test_checklist_status_receipt_matches_saved_item(demo):
    response = demo("PATCH", "/checklist/c-01?detail=status", json={"done": True})
    assert response.status_code == 200
    receipt = response.json()
    assert receipt == {"item_id": "c-01", "done": True, "auto_checked": False,
                       "review_needed": False, "review_reason": None}
    item = checklist_items(demo)["c-01"]
    assert receipt == {key: item[key] for key in receipt}
    assert demo("PATCH", "/checklist/missing?detail=status", json={"done": False}).status_code == 404


def test_document_status_receipt_preserves_full_detail_and_history(demo):
    listed = demo("GET", "/documents").json()
    document = next(row for row in listed["requirements"] if row["status"] == "not_started")
    path = f"/documents/{document['doc_key']}"
    response = demo("PATCH", path + "?detail=status", json={"status": "obtained"})
    assert response.status_code == 200
    receipt = response.json()
    assert receipt.pop("catalog_changed") is False
    assert receipt["status"] == "obtained" and "history" not in receipt
    detail = demo("GET", path).json()
    assert receipt == {key: detail[key] for key in receipt}
    assert detail["history"][0]["to"] == "obtained"
    assert demo("GET", "/documents").json()["summary"]["finished"] == listed["summary"]["finished"] + 1
