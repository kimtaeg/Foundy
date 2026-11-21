"""실제 PostgreSQL에서 분석 요청·저장·진행 전달·권한·장애를 검증한다."""

from contextlib import contextmanager
from datetime import timedelta
import json
import threading
import time
import uuid

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import delete, select

from agent.loop import run_analysis
from config import get_settings
from db.models import ReportItem, Run, User
from db.session import transaction
from main import app, cleanup_stale_runs
from services.timeutil import now_utc
from tests.fakes import FakeTools, SIMILAR
from tests.test_loop import llm

pytestmark = pytest.mark.skipif(not get_settings().database_url, reason="테스트 PostgreSQL 필요")


class CountingTools(FakeTools):
    def __init__(self):
        super().__init__(similar=SIMILAR)
        self.calls = []

    def building(self, store):
        self.calls.append("building")
        return super().building(store)

    def cached_building(self, store):
        self.calls.append("cached_building")
        return super().building(store)

    def trademark(self, name):
        self.calls.append("trademark")
        return super().trademark(name)

    def law(self, check_id, store=None):
        self.calls.append("law:" + check_id)
        return super().law(check_id, store)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def context(client, monkeypatch):
    manager = app.state.analysis_manager
    tools = CountingTools()
    monkeypatch.setattr(manager, "dependencies", lambda cost: (tools, llm()))
    monkeypatch.setattr(manager, "runner", run_analysis)
    monkeypatch.setattr(manager, "timeout", 5)
    users = []

    def create():
        response = client.post("/api/demo")
        assert response.status_code == 201
        body = response.json()
        users.append(body["user"]["user_id"])
        return body, {"Authorization": f"Bearer {body['access_token']}"}

    account, headers = create()
    base = f"/api/stores/{account['store_id']}"
    yield client, base, headers, tools, manager, create
    with transaction() as session:
        session.execute(delete(User).where(User.id.in_([uuid.UUID(u) for u in users])))


def wait(client, rid, headers):
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        response = client.get(f"/api/runs/{rid}", headers=headers)
        assert response.status_code == 200
        body = response.json()
        if body["status"] in {"done", "failed"}:
            return body
        time.sleep(0.01)
    pytest.fail("실행이 제한 시간 내 종료되지 않음")


def start(context, scope=None):
    client, base, headers, *_ = context
    response = client.post(base + "/analyze", headers=headers, json={} if scope is None else {"scope": scope})
    assert response.status_code == 202, response.text
    assert response.json()["status"] == "queued"
    return response.json()["run_id"]


def report(client, base, headers):
    body = client.get(base + "/report", headers=headers).json()
    return body, {i["item_id"]: i for g in body["groups"] for i in g["items"]}


@contextmanager
def blocked(manager, monkeypatch):
    entered, release, finished = threading.Event(), threading.Event(), threading.Event()
    execute = manager._execute
    def tracked(*args):
        try:
            execute(*args)
        finally:
            finished.set()
    def runner(*args, **kwargs):
        kwargs["emit"]("step", {"step": "building", "status": "running", "message": "테스트 대기"})
        kwargs["emit"]("done", {"summary": {}})  # 저장 전 완료 이벤트는 노출되면 안 된다.
        entered.set()
        assert release.wait(5)
        return run_analysis(*args, **kwargs)
    monkeypatch.setattr(manager, "runner", runner)
    monkeypatch.setattr(manager, "_execute", tracked)
    try:
        yield entered, release
    finally:
        release.set()
        assert finished.wait(5)


def test_full_analysis_saved_and_readable(context):
    client, base, headers, *_ = context
    rid = start(context)
    done = wait(client, rid, headers)
    assert done["status"] == "done" and done["started_at"] and done["finished_at"]
    assert [e["event"] for e in done["events"]].count("done") == 1
    assert done["events"][-1]["data"]["run_id"] == rid
    body, cards = report(client, base, headers)
    assert body["run_id"] == rid and len(cards) == 5
    assert cards["r-05"]["verdict"] == "unknown"
    assert client.get(base + "/dashboard", headers=headers).json()["last_run"]["run_id"] == rid
    assert client.get(base + "/checklist", headers=headers).json()["progress"] == {"done": 2, "total": 9}


@pytest.mark.parametrize("scope,expected", [
    (["building"], ["building"]),
    (["trademark"], ["trademark"]),
    (["checklist"], []),
    (["law"], ["cached_building", "law:building_use", "law:permit_docs"]),
])
def test_partial_scope_does_not_call_unselected_providers(context, scope, expected):
    client, base, headers, tools, *_ = context
    _, before = report(client, base, headers)
    rid = start(context, scope)
    assert wait(client, rid, headers)["status"] == "done"
    assert tools.calls == expected
    _, after = report(client, base, headers)
    unchanged = "r-02" if scope in (["building"], ["law"]) else "r-01"
    assert after[unchanged] == before[unchanged]


def test_duplicate_and_completion_only_after_persistence(context, monkeypatch):
    client, base, headers, _, manager, _ = context
    with blocked(manager, monkeypatch) as (entered, release):
        rid = start(context)
        assert entered.wait(2)
        state = client.get(f"/api/runs/{rid}", headers=headers).json()
        assert state["status"] == "running" and not any(e["event"] == "done" for e in state["events"])
        duplicate = client.post(base + "/analyze", headers=headers)
        assert duplicate.status_code == 409 and duplicate.json()["error"]["code"] == "RUN_IN_PROGRESS"
        release.set()
        assert wait(client, rid, headers)["status"] == "done"


def test_run_owner_and_invalid_input(context):
    client, base, headers, _, _, create = context
    rid = start(context)
    assert wait(client, rid, headers)["status"] == "done"
    _, other = create()
    for suffix in ["", "/stream"]:
        path = f"/api/runs/{rid}" + suffix
        assert client.get(path).status_code == 401
        assert client.get(path, headers=other).status_code == 403
    assert client.post(base + "/analyze", headers=other).status_code == 403
    assert client.get("/api/runs/not-a-uuid", headers=headers).status_code == 404
    assert client.get(f"/api/runs/{uuid.uuid4()}", headers=headers).status_code == 404
    for scope in [[], ["market"], ["grants"]]:
        assert client.post(base + "/analyze", headers=headers, json={"scope": scope}).status_code == 400
    assert "HTTPBearer" in client.get("/openapi.json").json()["components"]["securitySchemes"]


def test_sse_replays_stored_events_and_resumes(context):
    client, _, headers, *_ = context
    rid = start(context)
    done = wait(client, rid, headers)
    response = client.get(f"/api/runs/{rid}/stream", headers=headers)
    assert response.status_code == 200 and response.headers["content-type"].startswith("text/event-stream")
    assert response.text.count("event: done") == 1
    blocks = [b for b in response.text.split("\n\n") if b]
    assert len(blocks) == len(done["events"])
    for n, block in enumerate(blocks, 1):
        assert block.startswith(f"id: {n}\n")
        data = json.loads(block.split("\ndata: ")[1])
        assert data == done["events"][n - 1]["data"]
    resumed = client.get(f"/api/runs/{rid}/stream", headers={**headers, "Last-Event-ID": "2"})
    assert resumed.text.startswith("id: 3\n")
    assert client.get(f"/api/runs/{rid}/stream", headers={**headers, "Last-Event-ID": "-1"}).status_code == 400


def test_saved_demo_events_can_also_be_streamed(context):
    client, _, headers, *_ = context
    rid = client.get("/api/me", headers=headers).json()["store_id"]
    with transaction() as session:
        row = session.scalar(select(Run).where(Run.store_id == uuid.UUID(rid)))
        run_id = str(row.id)
    response = client.get(f"/api/runs/{run_id}/stream", headers=headers)
    assert response.status_code == 200 and f'"run_id": "{run_id}"' in response.text
    assert '"step": "grants"' not in response.text


def test_selected_state_memo_and_manual_checks_survive(context):
    client, base, headers, *_ = context
    chosen = client.post(base + "/report/items/r-01/choose", headers=headers, json={"option_id": "o-1"})
    assert chosen.status_code == 200 and chosen.json()["run_id"]  # 술 빼기 → 재분석이 바로 시작된다
    assert wait(client, chosen.json()["run_id"], headers)["status"] == "done"
    assert client.post(base + "/report/items/r-01/action", headers=headers,
                       json={"status": "done", "reply": "보존할 메모"}).status_code == 200
    assert client.patch(base + "/checklist/c-01", headers=headers, json={"done": True}).status_code == 200
    rid = start(context)
    assert wait(client, rid, headers)["status"] == "done"
    _, cards = report(client, base, headers)
    assert cards["r-01"]["chosen_option"] == "o-1" and cards["r-01"]["action_status"] == "done"
    assert cards["r-01"]["action_reply"] == "보존할 메모"
    checklist = client.get(base + "/checklist", headers=headers).json()
    task = next(i for g in checklist["groups"] for i in g["items"] if i["item_id"] == "c-01")
    assert task["done"] and not task["auto_checked"]


def test_choose_and_update_during_analysis_are_rejected_without_changes(context, monkeypatch):
    from db.models import ChangeLog
    client, base, headers, _, manager, _ = context
    sid = uuid.UUID(base.split("/")[-1])
    store_before = client.get(base, headers=headers).json()
    with blocked(manager, monkeypatch) as (entered, release):
        rid = start(context)
        assert entered.wait(2)
        chosen = client.post(base + "/report/items/r-01/choose", headers=headers, json={"option_id": "o-1"})
        assert chosen.status_code == 409 and chosen.json()["error"]["code"] == "RUN_IN_PROGRESS"
        updated = client.patch(base, headers=headers, json={"answers": {"sells_alcohol": False}})
        assert updated.status_code == 409 and updated.json()["error"]["code"] == "RUN_IN_PROGRESS"
        dates = client.patch(base, headers=headers, json={"opening_date": "2027-05-01"})
        assert dates.status_code == 409
        preview = client.patch(base + "?dry_run=true", headers=headers, json={"answers": {"sells_alcohol": False}})
        assert preview.status_code == 200 and preview.json()["dry_run"] is True  # 미리보기는 DB를 바꾸지 않아 허용
        release.set()
        assert wait(client, rid, headers)["status"] == "done"
    _, cards = report(client, base, headers)
    assert cards["r-01"]["chosen_option"] is None
    assert client.get(base, headers=headers).json() == store_before
    with transaction() as session:
        assert session.scalar(select(ChangeLog.id).where(ChangeLog.store_id == sid)) is None
        assert len(list(session.scalars(select(Run.id).where(Run.store_id == sid, Run.status.in_(["queued", "running"]))))) == 0


def test_conditions_changed_during_analysis_are_not_overwritten(context, monkeypatch):
    """API는 분석 중 변경을 막지만, 다른 경로로 조건이 바뀌어도 결과로 덮어쓰지 않는다."""
    from db.models import Store
    client, base, headers, _, manager, _ = context
    sid = uuid.UUID(base.split("/")[-1])
    before, _ = report(client, base, headers)
    with blocked(manager, monkeypatch) as (entered, release):
        rid = start(context)
        assert entered.wait(2)
        with transaction() as session:
            session.get(Store, sid).name = "분석 중 바뀐 이름"
        release.set()
        failed = wait(client, rid, headers)
        assert failed["status"] == "failed" and failed["events"][-1]["data"]["code"] == "INPUT_CHANGED"
    after, _ = report(client, base, headers)
    assert after["run_id"] == before["run_id"]


def test_invalid_result_rolls_back_all_changes(context, monkeypatch):
    client, base, headers, _, manager, _ = context
    before, _ = report(client, base, headers)
    def invalid(*args, **kwargs):
        result = run_analysis(*args, **kwargs)
        result.items[-1] = result.items[-1].model_copy(update={"stage": "invalid"})
        return result
    monkeypatch.setattr(manager, "runner", invalid)
    rid = start(context)
    failed = wait(client, rid, headers)
    assert failed["status"] == "failed" and failed["events"][-1]["event"] == "error"
    assert not any(e["event"] == "done" for e in failed["events"])
    assert report(client, base, headers)[0] == before


def test_timeout_prevents_late_result_write(context, monkeypatch):
    client, base, headers, _, manager, _ = context
    before, _ = report(client, base, headers)
    monkeypatch.setattr(manager, "timeout", 0.1)
    with blocked(manager, monkeypatch) as (entered, release):
        rid = start(context)
        assert entered.wait(2)
        failed = wait(client, rid, headers)
        assert failed["status"] == "failed" and failed["events"][-1]["data"]["code"] == "ANALYSIS_TIMEOUT"
        release.set()
    assert report(client, base, headers)[0] == before
    assert client.get(f"/api/runs/{rid}", headers=headers).json()["status"] == "failed"


def test_restart_cleanup_handles_queued_without_started_at(context):
    client, base, headers, *_ = context
    with transaction() as session:
        row = Run(store_id=uuid.UUID(base.split("/")[-1]), trigger="user", status="queued", scope=[], events=[],
                  created_at=now_utc() - timedelta(minutes=11))
        session.add(row)
        session.flush()
        rid = row.id
    assert cleanup_stale_runs() == 1
    state = client.get(f"/api/runs/{rid}", headers=headers).json()
    assert state["status"] == "failed" and state["events"][-1]["event"] == "error"
    next_id = start(context)
    assert wait(client, next_id, headers)["status"] == "done"


def test_cost_rows_are_saved_with_run_and_store(context, monkeypatch):
    from db.models import CostLog
    client, base, headers, tools, manager, _ = context
    monkeypatch.setenv("LLM_PRICE_IN_USD_PER_1M", "")
    monkeypatch.setenv("LLM_PRICE_OUT_USD_PER_1M", "")
    def dependencies(cost):
        cost.record("test", "synthetic-model", 10, 5)
        fake = llm()
        fake.cost = cost
        return tools, fake
    monkeypatch.setattr(manager, "dependencies", dependencies)
    rid = start(context)
    assert wait(client, rid, headers)["status"] == "done"
    with transaction() as session:
        cost = session.scalar(select(CostLog).where(CostLog.run_id == uuid.UUID(rid)))
        assert str(cost.store_id) == base.split("/")[-1]
        assert cost.input_tokens == 10 and cost.output_tokens == 5
        assert cost.cost_krw == 0


def test_closing_stream_does_not_cancel_analysis(context, monkeypatch):
    import asyncio
    from api.runs import stream
    client, _, headers, _, manager, _ = context
    class Request:
        async def is_disconnected(self):
            return False
    class ClosedSession:
        def close(self):
            pass
    with blocked(manager, monkeypatch) as (entered, release):
        rid = start(context)
        assert entered.wait(2)
        response = stream(Request(), SimpleRun(uuid.UUID(rid)), ClosedSession(), None)
        async def disconnect():
            event = await anext(response.body_iterator)
            assert "event: step" in event
            await response.body_iterator.aclose()
        asyncio.run(disconnect())
        release.set()
        assert wait(client, rid, headers)["status"] == "done"


class SimpleRun:
    def __init__(self, key):
        self.id = key


def test_default_mock_runtime_completes_without_live_keys(context, monkeypatch):
    client, base, headers, _, manager, _ = context
    monkeypatch.setattr(manager, "dependencies", None)
    monkeypatch.setattr(get_settings(), "use_mock", True)
    monkeypatch.setenv("LLM_API_KEY", "")
    rid = start(context)
    state = wait(client, rid, headers)
    assert state["status"] == "done"
    law = [e["data"] for e in state["events"] if e["event"] == "step" and e["data"]["step"] == "law"]
    assert law[-1]["status"] == "fallback" and "예시" in law[-1]["message"]
    _, cards = report(client, base, headers)
    assert any(e["from_mock"] for c in cards.values() for e in c["evidence"])


def test_global_capacity_is_bounded_and_duplicate_is_still_409(context, monkeypatch):
    client, base, headers, _, manager, create = context
    other, other_headers = create()
    third, third_headers = create()
    with blocked(manager, monkeypatch) as (entered, release):
        first = start(context)
        assert entered.wait(2)
        second = client.post(f"/api/stores/{other['store_id']}/analyze", headers=other_headers)
        assert second.status_code == 202
        rejected = client.post(f"/api/stores/{third['store_id']}/analyze", headers=third_headers)
        assert rejected.status_code == 503 and rejected.json()["error"]["code"] == "ANALYSIS_BUSY"
        assert client.post(base + "/analyze", headers=headers).status_code == 409
        release.set()
        assert wait(client, first, headers)["status"] == "done"
        assert wait(client, second.json()["run_id"], other_headers)["status"] == "done"


def test_actual_race_creates_only_one_active_run(context, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    client, base, headers, _, manager, _ = context
    barrier = threading.Barrier(3)
    def request():
        barrier.wait()
        return client.post(base + "/analyze", headers=headers)
    with blocked(manager, monkeypatch) as (entered, release):
        with ThreadPoolExecutor(max_workers=2) as workers:
            first, second = workers.submit(request), workers.submit(request)
            barrier.wait()
            responses = [first.result(timeout=3), second.result(timeout=3)]
        assert sorted(r.status_code for r in responses) == [202, 409]
        rid = next(r.json()["run_id"] for r in responses if r.status_code == 202)
        release.set()
        assert wait(client, rid, headers)["status"] == "done"


def test_legacy_ids_require_confirmation_and_are_not_rewritten(context):
    client, base, headers, *_ = context
    with transaction() as session:
        row = session.scalar(select(ReportItem).where(ReportItem.store_id == uuid.UUID(base.split("/")[-1]),
                                                      ReportItem.check_id == "trademark_similar"))
        row.item_key = "legacy-trademark"
    before, _ = report(client, base, headers)
    rid = start(context)
    state = wait(client, rid, headers)
    assert state["status"] == "failed" and state["events"][-1]["data"]["code"] == "RESULT_VERSION_MISMATCH"
    assert report(client, base, headers)[0] == before


def test_first_analysis_creates_results_and_checklist(context):
    from db.models import ChecklistItem, Store
    client, base, headers, *_ = context
    sid = uuid.UUID(base.split("/")[-1])
    with transaction() as session:
        session.execute(delete(ReportItem).where(ReportItem.store_id == sid))
        session.execute(delete(ChecklistItem).where(ChecklistItem.store_id == sid))
        session.execute(delete(Run).where(Run.store_id == sid))
        session.get(Store, sid).onboarded_at = None
    rid = start(context)
    assert wait(client, rid, headers)["status"] == "done"
    assert len(report(client, base, headers)[1]) == 5
    assert client.get(base + "/checklist", headers=headers).json()["progress"] == {"done": 0, "total": 9}


def test_failed_run_preserves_incurred_costs(context, monkeypatch):
    from db.models import CostLog
    client, _, headers, tools, manager, _ = context
    def dependencies(cost):
        cost.record("test-failed", "synthetic-model", 7, 3)
        return tools, llm()
    def failed(*args, **kwargs):
        raise RuntimeError("의도한 분석 장애")
    monkeypatch.setattr(manager, "dependencies", dependencies)
    monkeypatch.setattr(manager, "runner", failed)
    rid = start(context)
    assert wait(client, rid, headers)["status"] == "failed"
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        with transaction() as session:
            row = session.scalar(select(CostLog).where(CostLog.run_id == uuid.UUID(rid)))
            if row is not None:
                assert row.input_tokens == 7 and row.output_tokens == 3
                return
        time.sleep(0.01)
    pytest.fail("실패한 실행의 발생 비용이 저장되지 않음")
