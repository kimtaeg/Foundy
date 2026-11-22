"""서류함: 서류 요구사항 생성(기본 템플릿 + 법령 규칙), 서류별 상태·진행률, 법제처 공식 서식.

규칙 묶음·규칙 엔진·체크리스트 작업 생성은 가짜 없이 그대로 쓴다. DB·법제처 API 가 필요한 테스트는 실제로 호출하고,
DATABASE_URL·LAW_OC·마이그레이션 0006 이 없으면 그 테스트만 건너뛴다 (모의로 대신 통과시키지 않는다).
"""

import uuid
from datetime import date
from types import SimpleNamespace

import pytest
from sqlalchemy import text

from calc.obligation_tasks import apply_obligations
from config import get_settings
from db.models import ChecklistItem as OrmChecklistItem
from db.models import DocumentRequirement
from rules.applicability import evaluate_rules, facts_of
from rules.engine import derive_business_type, load_pack
from services.documents import DONE, STATUSES, desired_requirements, progress
from tests.test_obligation_tasks import CARD_OF, OPEN, PACK, base_list, make_store
from calc.dates import Dates


def orm_items(store):
    """실제 체크리스트 생성기가 만든 작업을 DB 행과 같은 모양의 ORM 객체로 바꾼다 (저장하지 않는다)."""
    bt = derive_business_type(PACK, store.answers)
    tasks = apply_obligations(PACK, evaluate_rules(PACK, store, bt), base_list(store), [], CARD_OF, Dates(), OPEN,
                              facts=facts_of(store, bt))
    return [OrmChecklistItem(item_key=t.item_id, rule_key=t.rule_key, task=t.task, category=t.category, due_date=t.due_date,
                             task_type=t.task_type, law_basis=t.law_basis, obligation_rule_id=t.obligation_rule_id,
                             reason=t.reason, statutory_deadline=t.statutory_deadline, done=False) for t in tasks], bt


def want(store, **eff_over):
    items, bt = orm_items(store)
    eff = {"uses_terrace": store.answers.get("uses_terrace"), "has_employees": store.answers.get("has_employees"), **eff_over}
    obligations = [SimpleNamespace(rule_id=o.rule_id, status=o.status, title=o.title, reason=o.reason, law_name=o.law_name,
                                   article_label=o.article_label) for o in evaluate_rules(PACK, store, bt)]
    return desired_requirements(PACK, items, obligations, eff, hidden=set())


def test_base_templates_and_rule_documents_are_merged():
    docs = want(make_store(answers={"uses_terrace": False}))
    assert {"bldg", "tm", "bizapply", "apply", "signapply", "contract", "insure", "label"} <= set(docs)  # 기본 템플릿
    assert {"edu_cert", "health_cert", "water_test", "fire_design"} <= set(docs)  # 법령 규칙이 더한 서류
    assert "outer_use" not in docs  # 테라스를 안 쓰면 외부 장소 서류는 없다


def test_document_types_and_applicability():
    docs = want(make_store(answers={"uses_terrace": False}))
    assert docs["bldg"]["document_type"] == "issued" and docs["apply"]["document_type"] == "application"
    assert docs["edu_cert"]["document_type"] == "certificate" and docs["contract"]["document_type"] == "kept"
    assert docs["tm"]["document_type"] == "reference"
    assert docs["edu_cert"]["applicability_status"] == "applies" and docs["edu_cert"]["source_type"] == "rule_engine"
    assert docs["water_test"]["applicability_status"] == "needs_check"  # 지하수를 쓰는 경우만이라 확인이 필요하다
    assert docs["fire_design"]["applicability_status"] == "needs_check"  # 다중이용업 해당 여부는 소방서 확인


def test_official_form_reference_is_kept_without_a_link():
    form = want(make_store())["apply"]["form"]
    assert form == {"law_name": "식품위생법 시행규칙", "form_no": "003700", "title": "식품 영업 신고서"}  # 링크는 법제처 수집값(law_forms)만 쓴다


def test_when_condition_follows_store_values():
    assert want(make_store(answers={"uses_terrace": True}))["outer_use"]["applicability_status"] == "applies"
    assert want(make_store(answers={"uses_terrace": None}))["outer_use"]["applicability_status"] == "needs_check"
    assert "outer_use" not in want(make_store(answers={"uses_terrace": False}))


def test_documents_follow_applicable_rules_and_hidden_tasks():
    small = want(make_store(area_sqm=50.0, answers={"has_employees": False}))
    assert "fire_design" not in small  # 면적 100㎡ 미만이면 소방 서류는 없다
    assert "contract" not in small and "insure" not in small  # 직원이 없으면 근로계약 서류 항목 자체가 숨겨진다


def test_one_document_is_linked_to_every_task_that_uses_it():
    docs = want(make_store())
    assert docs["apply"]["task_keys"] == ["c-04"] and docs["edu_cert"]["task_keys"] == ["c-05"]
    assert docs["health_cert"]["task_keys"] == ["c-06"] and docs["fire_design"]["task_keys"] == ["o-fire"]
    assert docs["apply"]["law_basis"]["article"] == "제37조"  # 법적 의무에 붙은 서류는 근거 조문을 가진다


def row(status, applicability="applies"):
    return DocumentRequirement(doc_key=str(uuid.uuid4()), name="x", document_type="issued", status=status,
                               applicability_status=applicability)


def test_progress_counts_document_status_not_checklist_and_skips_not_applicable():
    rows = [row("obtained"), row("submitted"), row("in_progress"), row("not_started"), row("needs_fix"),
            row("not_applicable"), row("not_started", "not_applicable")]
    assert progress(rows) == {"finished": 2, "total": 5}  # 해당 없음 2개는 분모에서 빠진다
    assert DONE == {"obtained", "submitted"} and "submitted" in STATUSES and STATUSES["obtained"] != STATUSES["submitted"]


# ---------------------------------------------------------------- 실제 DB·법제처 호출

def _tables_ready() -> bool:
    if not get_settings().database_url:
        return False
    from db.session import transaction

    try:
        with transaction() as s:
            s.execute(text("select 1 from document_requirements limit 1"))
        return True
    except Exception:
        return False


needs_db = pytest.mark.skipif(not _tables_ready(), reason="DATABASE_URL 이 없거나 마이그레이션 0006(서류함)이 적용되지 않았습니다")


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def account(client):
    from sqlalchemy import delete

    from db.models import User
    from db.session import transaction

    body = client.post("/api/demo").json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    yield client, f"/api/stores/{body['store_id']}/documents", headers
    with transaction() as s:
        s.execute(delete(User).where(User.id == uuid.UUID(body["user"]["user_id"])))


@needs_db
def test_documents_list_creates_requirements_with_independent_status(account):
    client, base, headers = account
    body = client.get(base, headers=headers).json()
    assert body["summary"]["total"] > 0 and body["summary"]["finished"] == 0
    first = body["requirements"][0]
    assert first["status"] == "not_started" and first["type"] in ("issued", "application", "certificate", "kept", "reference")
    assert body["groups"] and body["groups"][0]["documents"][0]["status"]  # 예전 모양(체크리스트 항목별)도 유지한다


@needs_db
def test_status_change_is_separate_from_checklist_and_recorded(account):
    client, base, headers = account
    body = client.get(base, headers=headers).json()
    key = body["requirements"][0]["doc_key"]
    done_before = [g["done"] for g in body["groups"]]
    res = client.patch(f"{base}/{key}", headers=headers, json={"status": "obtained", "note": "정부24에서 발급"})
    assert res.status_code == 200 and res.json()["status"] == "obtained"
    after = client.get(base, headers=headers).json()
    assert after["summary"]["finished"] == 1  # 서류 진행률은 서류 상태로 센다
    assert [g["done"] for g in after["groups"]] == done_before  # 체크리스트 항목은 그대로
    client.patch(f"{base}/{key}", headers=headers, json={"status": "submitted"})
    hist = client.get(f"{base}/{key}", headers=headers).json()["history"]
    assert [h["to"] for h in hist][:2] == ["submitted", "obtained"]  # 발급·취득과 제출은 따로 남는다


@needs_db
def test_requirement_lists_task_category_and_review_ack_clears_the_notice(account):
    """서류함 화면은 연결된 작업의 카테고리로 묶고, 재검토 안내는 확인 처리(review_ack)로 지운다."""
    from sqlalchemy import select, update

    from db.models import DocumentRequirement
    from db.session import transaction

    client, base, headers = account
    body = client.get(base, headers=headers).json()
    doc = next(r for r in body["requirements"] if r["tasks"])
    assert doc["tasks"][0]["category"] and doc["tasks"][0]["group_label"]
    with transaction() as s:  # 법령 개정이 감지된 것과 같은 상태를 만든다
        s.execute(update(DocumentRequirement).where(DocumentRequirement.doc_key == doc["doc_key"],
                                                    DocumentRequirement.store_id == uuid.UUID(base.split("/")[3]))
                  .values(review_needed=True, review_reason="식품위생법이 개정됐어요"))
    flagged = client.get(f"{base}/{doc['doc_key']}", headers=headers).json()
    assert flagged["review_needed"] is True and flagged["review_reason"] == "식품위생법이 개정됐어요"
    assert client.patch(f"{base}/{doc['doc_key']}", headers=headers, json={}).status_code == 400  # 상태도 확인도 없으면 거절
    acked = client.patch(f"{base}/{doc['doc_key']}", headers=headers, json={"review_ack": True}).json()
    assert acked["review_needed"] is False and acked["status"] == "not_started"  # 상태는 그대로다


@needs_db
def test_dashboard_reads_document_progress_without_creating_documents(account):
    """대시보드는 서류를 만들지 않고 저장된 서류의 상태로 진행률을 센다 (동시 요청이 겹치지 않게)."""
    client, base, headers = account
    store_base = base.rsplit("/documents", 1)[0]
    first = client.get(store_base + "/dashboard", headers=headers).json()["documents_progress"]
    assert first["finished"] == 0
    docs = client.get(base, headers=headers).json()  # 서류함을 열면 서류가 만들어진다
    client.patch(f"{base}/{docs['requirements'][0]['doc_key']}", headers=headers, json={"status": "submitted"})
    after = client.get(store_base + "/dashboard", headers=headers).json()["documents_progress"]
    assert after == {"finished": 1, "total": docs["summary"]["total"]}


@needs_db
def test_invalid_status_and_unknown_document_are_rejected(account):
    client, base, headers = account
    key = client.get(base, headers=headers).json()["requirements"][0]["doc_key"]
    assert client.patch(f"{base}/{key}", headers=headers, json={"status": "done"}).status_code == 400
    assert client.patch(f"{base}/nope", headers=headers, json={"status": "obtained"}).status_code == 404


@needs_db
def test_not_applicable_leaves_the_denominator(account):
    client, base, headers = account
    body = client.get(base, headers=headers).json()
    total = body["summary"]["total"]
    client.patch(f"{base}/{body['requirements'][0]['doc_key']}", headers=headers, json={"status": "not_applicable"})
    assert client.get(base, headers=headers).json()["summary"]["total"] == total - 1


@needs_db
def test_documents_have_no_file_upload_or_phone_contact(account):
    """서류함은 서류 상태만 관리한다: 파일 올리기 API와 응답의 files·contact 는 없다."""
    client, base, headers = account
    body = client.get(base, headers=headers).json()
    key = body["requirements"][0]["doc_key"]
    assert all("files" not in r and "contact" not in r for r in body["requirements"])
    assert client.put(f"{base}/{key}/files", headers={**headers, "Content-Type": "application/pdf",
                                                      "X-File-Name": "a.pdf"}, content=b"%PDF").status_code in (404, 405)
    assert client.get(f"{base}/{key}/files/00000000-0000-0000-0000-000000000000", headers=headers).status_code in (404, 405)


@needs_db
def test_other_users_cannot_read_documents(client, account):
    _, base, headers = account
    other = client.post("/api/demo").json()
    try:
        res = client.get(base, headers={"Authorization": f"Bearer {other['access_token']}"})
        assert res.status_code in (403, 404)
    finally:
        from sqlalchemy import delete

        from db.models import User
        from db.session import transaction

        with transaction() as s:
            s.execute(delete(User).where(User.id == uuid.UUID(other["user"]["user_id"])))


def test_real_law_api_finds_the_official_business_report_form():
    """법제처 서식 검색(licbyl)에서 식품 영업 신고서(별지 제37호서식)의 PDF 링크를 실제로 찾는다."""
    from law_rag.collector import LawApiError, LawCollector
    from law_rag.forms import find_form, form_refs

    if not get_settings().law_oc:
        pytest.skip("LAW_OC 가 없어 건너뜁니다")
    collector = LawCollector()
    try:
        found = find_form(collector, form_refs(PACK)[0])
    except (LawApiError, Exception) as e:  # IP 미등록·네트워크 문제는 코드 문제가 아니라 환경 문제로 건너뛴다
        pytest.skip(f"법제처 API 를 호출하지 못했습니다: {type(e).__name__}")
    finally:
        collector.close()
    assert found and found["별표번호"] == "003700" and found["별표서식PDF파일링크"].startswith("/LSW/flDownload.do?flSeq=")
    assert re_date(found["공포일자"])


def re_date(value):
    return bool(value) and len(value) == 8 and value.isdigit()


@needs_db
def test_form_revision_keeps_history_and_flags_requirements():
    """서식이 개정되면 새 행을 만들고 이전 행은 남기며, 그 서식을 쓰는 서류에 재검토를 표시한다 (실제 DB, 마지막에 롤백)."""
    from db.models import LawForm
    from db.session import _session_factory
    from law_rag.forms import save_form
    from sqlalchemy import select

    ref = {"law_name": "테스트용 법령", "form_no": "999999", "title": "테스트 서식"}
    session = _session_factory()()
    try:
        first = save_form(session, ref, {"공포일자": "20260101", "별표명": "테스트 서식", "별표서식PDF파일링크": "/LSW/a.pdf"})
        again = save_form(session, ref, {"공포일자": "20260101", "별표명": "테스트 서식", "별표서식PDF파일링크": "/LSW/a.pdf"})
        newer = save_form(session, ref, {"공포일자": "20260901", "별표명": "테스트 서식", "별표서식PDF파일링크": "/LSW/b.pdf"})
        assert (first.change, again.change, newer.change) == ("added", "unchanged", "updated")
        rows = list(session.scalars(select(LawForm).where(LawForm.law_name == ref["law_name"]).order_by(LawForm.promulgated_on)))
        assert [r.is_current for r in rows] == [False, True] and rows[1].pdf_path == "/LSW/b.pdf"
    finally:
        session.rollback()
        session.close()
