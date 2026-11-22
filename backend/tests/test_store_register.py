"""가게 등록·답변·조회 (Notion 4번): POST /stores, /answers, GET /stores/{id} 와 주소 변환 도구.

주소는 가짜 응답(httpx.MockTransport·대역 함수)으로 확인한다. 실제 카카오 로컬 API 연결은 검증하지 않는다.
"""

from datetime import timedelta
import time
import uuid

import httpx
import pytest
from sqlalchemy import delete, func, select

from config import get_settings
from db.models import Run, Store, User
from db.session import transaction
from services import store_register
from services.auth import issue_token
from tools import address as address_tool
from tools.address import AddressResult, resolve_address

DB = pytest.mark.skipif(not get_settings().database_url, reason="테스트 PostgreSQL 필요")

CODES = {"sigungu_cd": "11200", "bjdong_cd": "11500", "bun": "0289", "ji": "0010", "plat_gb_cd": "0"}
KAKAO_DOC = {"address_name": "서울 성동구 성수동2가 289-10", "x": "127.05", "y": "37.54",
             "address": {"address_name": "서울 성동구 성수동2가 289-10", "b_code": "1120011500", "main_address_no": "289",
                         "sub_address_no": "10", "mountain_yn": "N", "region_1depth_name": "서울",
                         "region_2depth_name": "성동구", "region_3depth_name": "성수동2가"},
             "road_address": {"address_name": "서울 성동구 성수이로 113"}}
BODY = {"name": "새가게", "business_type_input": "카페", "address": "서울 성동구 성수이로 113",
        "address_detail": "1층", "opening_date": "2027-05-01", "owner_birth_year": 1997}


# ---------- 주소 변환 도구 (DB 없음) ----------

def kakao(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_address_is_unverified_without_key_or_in_mock_mode():
    assert resolve_address("어딘가", key="", use_mock=False).status == "unverified"
    assert resolve_address("어딘가", key="k", use_mock=True).status == "unverified"


def test_address_resolved_parses_codes_region_and_coord():
    result = resolve_address("성수이로 113", key="k", use_mock=False,
                             client=kakao(lambda r: httpx.Response(200, json={"documents": [KAKAO_DOC]})))
    assert result.status == "resolved" and result.codes == CODES
    assert result.road == "서울 성동구 성수이로 113" and result.region == "서울 성동구 성수동2가"
    assert result.coord == {"lat": 37.54, "lng": 127.05}


def test_address_not_found_and_ambiguous_are_distinct_from_outage():
    empty = resolve_address("없는 주소", key="k", use_mock=False,
                            client=kakao(lambda r: httpx.Response(200, json={"documents": []})))
    assert empty.status == "not_found" and empty.candidates == []
    docs = [{**KAKAO_DOC, "address_name": f"후보 {i}"} for i in range(7)]
    many = resolve_address("성수동", key="k", use_mock=False,
                           client=kakao(lambda r: httpx.Response(200, json={"documents": docs})))
    assert many.status == "ambiguous" and many.candidates == [f"후보 {i}" for i in range(5)]
    for handler in (lambda r: httpx.Response(500, json={}), lambda r: httpx.Response(401, json={}),
                    lambda r: (_ for _ in ()).throw(httpx.ConnectError("down", request=r)),
                    lambda r: httpx.Response(200, text="not json")):
        assert resolve_address("성수이로", key="k", use_mock=False, client=kakao(handler)).status == "lookup_failed"


def test_business_type_validation_comes_from_rule_pack():
    pack = store_register.get_pack()
    assert store_register.supported_business_types(pack) == ["카페", "음식점"]
    assert store_register.validate_business_type(pack, "음식점") == "음식점"
    with pytest.raises(store_register.ApiError):
        store_register.validate_business_type(pack, "술집")


# ---------- API (실제 PostgreSQL) ----------

@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def no_real_llm(monkeypatch):
    monkeypatch.setattr(store_register, "question_llm", lambda: None)  # 규칙 후보를 모두 묻는다


@pytest.fixture
def users():
    ids: list[uuid.UUID] = []

    def make(provider="kakao"):
        with transaction() as session:
            user = User(provider=provider, provider_user_id=str(uuid.uuid4()), name="테스트")
            session.add(user)
            session.flush()
            ids.append(user.id)
            return {"Authorization": f"Bearer {issue_token(str(user.id))}"}, user.id
    yield make
    with transaction() as session:
        session.execute(delete(User).where(User.id.in_(ids)))


def use_resolver(monkeypatch, result: AddressResult):
    monkeypatch.setattr(store_register, "resolve_address", lambda *a, **k: result)


def register(client, headers, **override):
    return client.post("/api/stores", headers=headers, json={**BODY, **override})


def store_row(user_id):
    with transaction() as session:
        return session.scalar(select(Store).where(Store.user_id == user_id))


@DB
def test_register_in_mock_mode_saves_without_codes_and_returns_questions(client, users):
    headers, uid = users()
    res = register(client, headers)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["address_status"] == "unverified" and body["address_resolved"] is None
    assert [q["id"] for q in body["questions"]] == ["sells_alcohol", "uses_terrace", "has_employees", "does_delivery", "funds_krw"]
    row = store_row(uid)
    assert row.address_codes is None and row.sells_alcohol is None and row.has_employees is None
    me = client.get("/api/me", headers=headers).json()
    assert me["store_id"] == body["store_id"] and me["store_name"] == BODY["name"]
    assert me["store_opening"] == BODY["opening_date"]
    assert me["setup"] == body["setup"] == {
        "status": "missing_answers", "missing_fields": ["sells_alcohol", "uses_terrace", "has_employees"], "run_id": None,
    }
    store = client.get(f"/api/stores/{body['store_id']}", headers=headers).json()
    assert store["answers"] == {"sells_alcohol": None, "uses_terrace": None, "has_employees": None, "funds_krw": None,
                               "does_delivery": None, "area_sqm": None}
    assert store["business_type"] is None and store["address_detail"] == "1층" and store["owner_birth_year"] == 1997
    assert store["is_demo"] is False and store["opening_date"] == "2027-05-01"


@DB
def test_register_with_fixed_questions_does_not_prepare_llm(client, users, monkeypatch):
    headers, _ = users()

    def fail_if_called():
        pytest.fail("가게 기본 정보 저장에는 LLM이 필요하지 않다")

    monkeypatch.setattr(store_register, "question_llm", fail_if_called)
    res = register(client, headers, fixed_questions=True)
    assert res.status_code == 201, res.text
    assert [question["id"] for question in res.json()["questions"]] == ["sells_alcohol", "uses_terrace", "has_employees"]


@DB
def test_register_saves_resolved_codes(client, users, monkeypatch):
    headers, uid = users()
    use_resolver(monkeypatch, AddressResult(status="resolved", codes=CODES, road="서울 성동구 성수이로 113",
                                            jibun="서울 성동구 성수동2가 289-10", coord={"lat": 37.54, "lng": 127.05},
                                            region="서울 성동구 성수동2가"))
    body = register(client, headers).json()
    assert body["address_status"] == "resolved" and body["address_resolved"]["codes"] == CODES
    row = store_row(uid)
    assert row.address_codes == {**CODES, "coord": {"lat": 37.54, "lng": 127.05}} and row.region == "서울 성동구 성수동2가"


@DB
@pytest.mark.parametrize("result,reason", [
    (AddressResult(status="not_found"), "not_found"),
    (AddressResult(status="ambiguous", candidates=["후보 A", "후보 B"]), "ambiguous"),
])
def test_unresolved_address_is_422_and_saves_nothing(client, users, monkeypatch, result, reason):
    headers, uid = users()
    use_resolver(monkeypatch, result)
    res = register(client, headers)
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "ADDRESS_NOT_RESOLVED" and error["reason"] == reason
    assert error["candidates"] == result.candidates
    assert store_row(uid) is None


@DB
def test_address_service_outage_registers_with_distinct_status(client, users, monkeypatch):
    headers, uid = users()
    use_resolver(monkeypatch, AddressResult(status="lookup_failed"))
    res = register(client, headers)
    assert res.status_code == 201 and res.json()["address_status"] == "lookup_failed"
    assert store_row(uid).address_codes is None


@DB
@pytest.mark.parametrize("override", [
    {"name": "  "}, {"address": ""}, {"business_type_input": "술집"}, {"opening_date": "2027-02-30"},
    {"owner_birth_year": 1800}, {"unknown": 1}, {"name": None},
])
def test_invalid_input_is_400_and_saves_nothing(client, users, override):
    headers, uid = users()
    res = register(client, headers, **override)
    assert res.status_code == 400 and res.json()["error"]["code"] == "INVALID_INPUT", override
    assert store_row(uid) is None


@DB
def test_missing_required_fields_are_400(client, users):
    headers, uid = users()
    for field in ("name", "business_type_input", "address", "opening_date"):
        payload = {k: v for k, v in BODY.items() if k != field}
        assert client.post("/api/stores", headers=headers, json=payload).status_code == 400, field
    assert store_row(uid) is None


@DB
def test_one_store_per_account(client, users):
    headers, _ = users()
    assert register(client, headers).status_code == 201
    again = register(client, headers, name="두번째")
    assert again.status_code == 409 and again.json()["error"]["code"] == "STORE_EXISTS"
    demo = client.post("/api/demo").json()
    try:
        res = register(client, {"Authorization": f"Bearer {demo['access_token']}"})
        assert res.status_code == 409  # 예시 계정도 이미 가게가 있다
    finally:
        with transaction() as session:
            session.execute(delete(User).where(User.id == uuid.UUID(demo["user"]["user_id"])))
    assert client.post("/api/stores", json=BODY).status_code == 401


@DB
def test_answers_decide_business_type_and_keep_omitted_fields(client, users):
    headers, uid = users()
    sid = register(client, headers).json()["store_id"]
    answers = lambda payload: client.post(f"/api/stores/{sid}/answers", headers=headers, json={"answers": payload})

    first = answers({"sells_alcohol": True})
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["business_type"] == "일반음식점" and body["business_type_reason"] == "주류 판매 → 일반음식점 (규칙)"
    assert [q["id"] for q in body["questions"]] == ["uses_terrace", "has_employees"]  # 선택 질문(자금)은 다시 묻지 않는다

    second = answers({"has_employees": False}).json()  # 명시한 false 는 저장, 생략한 값은 그대로
    assert second["answers"] == {"sells_alcohol": True, "uses_terrace": None, "has_employees": False, "funds_krw": None,
                                "does_delivery": None, "area_sqm": None}
    assert [q["id"] for q in second["questions"]] == ["uses_terrace"]

    third = answers({"sells_alcohol": False, "uses_terrace": False, "funds_krw": 30000000}).json()
    assert third["business_type"] == "휴게음식점" and third["questions"] == []
    assert third["answers"] == {"sells_alcohol": False, "uses_terrace": False, "has_employees": False,
                                "funds_krw": 30000000, "does_delivery": None, "area_sqm": None}
    assert answers({"funds_krw": None}).json()["answers"]["funds_krw"] is None  # 준비 자금만 비울 수 있다

    store = client.get(f"/api/stores/{sid}", headers=headers).json()
    row = store_row(uid)
    assert store["answers"] == {"sells_alcohol": row.sells_alcohol, "uses_terrace": row.uses_terrace,
                                "has_employees": row.has_employees, "funds_krw": row.funds_krw,
                                "does_delivery": row.does_delivery,
                                "area_sqm": float(row.area_sqm) if row.area_sqm is not None else None}
    assert store["business_type"] == row.business_type == "휴게음식점"


@DB
@pytest.mark.parametrize("payload", [{}, {"sells_alcohol": None}, {"sells_alcohol": "maybe"},
                                     {"funds_krw": -1}, {"menu_text": "x"}])
def test_invalid_answers_are_400(client, users, payload):
    headers, uid = users()
    sid = register(client, headers).json()["store_id"]
    res = client.post(f"/api/stores/{sid}/answers", headers=headers, json={"answers": payload})
    assert res.status_code == 400, payload
    assert store_row(uid).sells_alcohol is None


@DB
def test_other_account_cannot_read_or_answer(client, users):
    owner, _ = users()
    other, _ = users()
    sid = register(client, owner).json()["store_id"]
    assert client.get(f"/api/stores/{sid}", headers=other).status_code == 403
    res = client.post(f"/api/stores/{sid}/answers", headers=other, json={"answers": {"sells_alcohol": True}})
    assert res.status_code == 403 and res.json()["error"]["code"] == "FORBIDDEN"


@DB
def test_answers_rejected_during_analysis_and_after_onboarding(client, users):
    headers, uid = users()
    sid = register(client, headers).json()["store_id"]
    with transaction() as session:
        run = Run(store_id=uuid.UUID(sid), trigger="user", scope=["building"], status="running", events=[])
        session.add(run)
    res = client.post(f"/api/stores/{sid}/answers", headers=headers, json={"answers": {"sells_alcohol": True}})
    assert res.status_code == 409 and res.json()["error"]["code"] == "RUN_IN_PROGRESS"
    assert store_row(uid).sells_alcohol is None
    with transaction() as session:
        session.execute(delete(Run).where(Run.store_id == uuid.UUID(sid)))
        session.scalar(select(Store).where(Store.id == uuid.UUID(sid))).onboarded_at = store_register.now_utc()
    res = client.post(f"/api/stores/{sid}/answers", headers=headers, json={"answers": {"sells_alcohol": True}})
    assert res.status_code == 400 and "마이페이지" in res.json()["error"]["message"]


@DB
def test_question_selection_failure_does_not_block_registration(client, users, monkeypatch):
    class Broken:
        def parse(self, **kwargs):
            raise RuntimeError("예상하지 못한 오류")

    class PicksNothing:
        def parse(self, **kwargs):
            return kwargs["schema"](ids=[])

    headers, _ = users()
    monkeypatch.setattr(store_register, "question_llm", lambda: Broken())
    assert len(register(client, headers).json()["questions"]) == 5
    headers, _ = users()
    monkeypatch.setattr(store_register, "question_llm", lambda: PicksNothing())
    assert [q["id"] for q in register(client, headers).json()["questions"]] == ["sells_alcohol"]  # 필수 질문은 항상


@DB
def test_new_account_flow_login_register_answer_analyze_report(client, users, monkeypatch):
    """새 계정: 등록 → 답변 → 분석(가짜 도구·LLM) → 리포트 조회."""
    from agent.loop import run_analysis
    from main import app
    from tests.fakes import FakeTools
    from tests.test_loop import llm

    manager = app.state.analysis_manager
    monkeypatch.setattr(manager, "dependencies", lambda cost: (FakeTools(), llm()))
    monkeypatch.setattr(manager, "runner", run_analysis)
    headers, _ = users()
    sid = register(client, headers).json()["store_id"]
    base = f"/api/stores/{sid}"
    answer = client.post(base + "/answers", headers=headers, json={"answers": {"sells_alcohol": True}})
    assert answer.status_code == 200
    assert answer.json()["setup"]["missing_fields"] == ["uses_terrace", "has_employees"]

    early = client.post(base + "/analyze", headers=headers, json={})
    assert early.status_code == 422
    assert early.json()["error"]["code"] == "SETUP_INCOMPLETE"
    assert early.json()["error"]["missing_fields"] == ["uses_terrace", "has_employees"]

    edit = client.patch(base, headers=headers, json={"name": "설정을 완료할 가게", "answers": {
        "uses_terrace": False, "has_employees": True,
    }})
    assert edit.status_code == 200
    assert not edit.json()["needs_reanalyze"] and edit.json()["run_id"] is None
    assert edit.json()["setup"] == {"status": "needs_analysis", "missing_fields": [], "run_id": None}
    assert client.get("/api/me", headers=headers).json()["setup"] == edit.json()["setup"]
    with transaction() as session:
        assert session.scalar(select(Run.id).where(Run.store_id == uuid.UUID(sid))) is None

    # 첫 분석은 전체 점검과 체크리스트를 만들어야 한다.
    run = client.post(base + "/analyze", headers=headers, json={"scope": ["building"]})
    assert run.status_code == 202
    rid = run.json()["run_id"]
    deadline = time.monotonic() + 20  # 원격 DB 왕복이 있어 5초로는 부족할 수 있다
    while time.monotonic() < deadline:
        state = client.get(f"/api/runs/{rid}", headers=headers).json()["status"]
        if state in ("done", "failed"):
            break
        time.sleep(0.02)
    assert state == "done"
    ready = client.get("/api/me", headers=headers).json()
    assert ready["setup"] == {"status": "ready", "missing_fields": [], "run_id": rid}
    assert ready["store_name"] == "설정을 완료할 가게"
    report = client.get(f"/api/stores/{sid}/report", headers=headers).json()
    assert sum(len(g["items"]) for g in report["groups"]) >= 4
    assert client.get(base + "/checklist", headers=headers).json()["progress"]["total"] == 13
    after = client.post(f"/api/stores/{sid}/answers", headers=headers, json={"answers": {"has_employees": False}})
    assert after.status_code == 400  # 첫 분석 뒤에는 마이페이지에서 수정


@DB
def test_first_analysis_can_resume_or_retry(client, users):
    headers, _ = users()
    sid = register(client, headers).json()["store_id"]
    base = f"/api/stores/{sid}"
    answers = {"sells_alcohol": False, "uses_terrace": False, "has_employees": False}
    assert client.post(base + "/answers", headers=headers, json={"answers": answers}).status_code == 200
    with transaction() as session:
        run = Run(store_id=uuid.UUID(sid), trigger="user", scope=["building"], status="running", events=[])
        session.add(run)
        session.flush()
        rid = run.id

    current = client.get("/api/me", headers=headers).json()["setup"]
    assert current == {"status": "analyzing", "missing_fields": [], "run_id": str(rid)}
    with transaction() as session:
        session.get(Run, rid).status = "failed"
    current = client.get("/api/me", headers=headers).json()["setup"]
    assert current == {"status": "failed", "missing_fields": [], "run_id": str(rid)}
