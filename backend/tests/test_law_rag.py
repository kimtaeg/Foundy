"""법령 RAG: 조문 파서·청커·적용 조건 규칙(DB 없이) + 저장·하이브리드 검색·변경 감지·API(DB)."""

import copy
import json
import uuid
from pathlib import Path

import pytest
from sqlalchemy import delete, select

from agent.ports import StoreInput
from config import get_settings
from law_rag.chunker import MAX_CHUNK, chunk_text, embed_text
from law_rag.embedder import DIM, HashEmbedder
from law_rag.parser import ParsedArticle, ParsedLaw, parse_law
from rules.applicability import (
    APPLIES, NEEDS_CHECK, NOT_APPLICABLE, evaluate_rule, evaluate_rules, floor_from_detail)
from rules.engine import load_pack

MOCKS = Path(__file__).resolve().parents[1] / "mocks"
PACK = load_pack("cafe_restaurant")
needs_db = pytest.mark.skipif(not get_settings().database_url, reason="테스트 PostgreSQL 필요")


# ---------------------------------------------------------------- 파서·청커 (DB 없음)

@pytest.fixture(scope="module")
def food_law() -> ParsedLaw:
    return parse_law(json.loads((MOCKS / "law_body.json").read_text(encoding="utf-8")), mst="285339")


def test_parser_reads_real_food_sanitation_act(food_law):
    assert food_law.name == "식품위생법" and food_law.law_key == "001805" and food_law.mst == "285339"
    assert food_law.effective_date.isoformat() == "2026-10-08"
    by_label = {a.label: a for a in food_law.articles}
    assert "제37조" in by_label and "제41조" in by_label
    assert by_label["제37조"].title == "영업허가 등"
    assert "영업신고" in by_label["제37조"].content or "신고하여야 한다" in by_label["제37조"].content
    assert len(by_label) == len(food_law.articles)  # 라벨이 겹치지 않는다
    assert all(a.kind == "article" for a in food_law.articles if a.label.startswith("제"))


def test_parser_reads_annex_of_building_decree():
    law = parse_law(json.loads((MOCKS / "law_building_decree_body.json").read_text(encoding="utf-8")), mst="1")
    annex = {a.label: a for a in law.articles if a.kind == "annex"}
    assert "별표 1" in annex and annex["별표 1"].title.startswith("용도별 건축물의 종류")
    assert "휴게음식점" in annex["별표 1"].content and "일반음식점" in annex["별표 1"].content
    assert not any((a.title or "").startswith("삭제") for a in annex.values())


def test_body_hash_changes_only_when_content_changes(food_law):
    before = food_law.body_hash
    changed = copy.deepcopy(food_law)
    changed.articles[0] = ParsedArticle("article", changed.articles[0].number, 0, changed.articles[0].label,
                                        None, changed.articles[0].content + " 개정", None)
    assert changed.body_hash != before and copy.deepcopy(food_law).body_hash == before


def test_chunks_respect_size_and_keep_original_text():
    long_line = "영업자는 위생교육을 받아야 한다. " * 200
    chunks = chunk_text("① 첫째 항\n② 둘째 항\n" + long_line)
    assert all(len(c) <= MAX_CHUNK for c in chunks) and len(chunks) > 1
    joined = "".join(chunks).replace("\n", "").replace(" ", "")
    assert "첫째항" in joined and "둘째항" in joined
    assert chunk_text("짧은 조문") == ["짧은 조문"]
    assert embed_text("식품위생법", "제37조", "영업허가 등", "본문").startswith("식품위생법 제37조(영업허가 등)\n")


def test_hash_embedder_is_deterministic_and_unit_length():
    emb = HashEmbedder()
    a, b = emb.embed_query("영업신고 위생교육"), emb.embed_query("영업신고 위생교육")
    assert a == b and len(a) == DIM and abs(sum(x * x for x in a) - 1) < 1e-6
    close = sum(x * y for x, y in zip(a, emb.embed_query("위생교육 영업신고 서류")))
    far = sum(x * y for x, y in zip(a, emb.embed_query("건축물 바닥면적 용도지역")))
    assert close > far


# ---------------------------------------------------------------- 적용 조건 규칙 (DB 없음)

def store(**kw) -> StoreInput:
    base = dict(store_id="s", name="모노커피", address="서울", address_detail="2층", opening_date="2027-03-02",
                answers={"sells_alcohol": True, "uses_terrace": False, "has_employees": True, "does_delivery": False},
                area_sqm=120)
    base.update(kw)
    return StoreInput(**base)


def outcome(rule_id, **kw):
    return {o.rule_id: o for o in evaluate_rules(PACK, store(**kw), "일반음식점")}[rule_id]


def test_floor_parsing():
    assert [floor_from_detail(x) for x in ("1층", "2층 201호", "지하 1층", "B1", "", None, "상가동")] == \
        [1, 2, -1, -1, None, None, None]


def test_fire_rule_depends_on_area_and_floor():
    assert outcome("FIRE-DENSE-001").status == APPLIES
    assert outcome("FIRE-DENSE-001", area_sqm=60).status == NOT_APPLICABLE
    first = outcome("FIRE-DENSE-001", address_detail="1층")
    assert first.status == NEEDS_CHECK and "1층" in first.reason  # 예외(1층)는 확인 필요
    unknown = outcome("FIRE-DENSE-001", area_sqm=None)
    assert unknown.status == NEEDS_CHECK and unknown.missing_inputs == ["area_sqm"]


def test_labor_rules_follow_employee_answer():
    assert outcome("LABOR-CONTRACT-001").status == APPLIES
    no = outcome("LABOR-CONTRACT-001", answers={"sells_alcohol": True, "has_employees": False})
    assert no.status == NOT_APPLICABLE
    unknown = outcome("LABOR-CONTRACT-001", answers={"sells_alcohol": True})
    assert unknown.status == NEEDS_CHECK and unknown.missing_inputs == ["has_employees"]


def test_unknown_business_type_is_never_guessed():
    result = evaluate_rule(PACK["applicability_rules"][0], {"business_type": None})
    assert result.status == NEEDS_CHECK and result.missing_inputs == ["business_type"]


def test_every_rule_has_law_and_is_draft_until_reviewed():
    for rule in PACK["applicability_rules"]:
        assert rule["law"]["law_name"] in PACK["law_sources"], rule["rule_id"]
        assert rule.get("review_status", "draft") in ("draft", "reviewed")
    for spec in PACK["checks"]:
        for rule_id in spec.get("rule_ids", []):
            assert rule_id in {r["rule_id"] for r in PACK["applicability_rules"]}
    for check_id, cfg in PACK["law_rag"]["checks"].items():
        assert all(name in PACK["law_sources"] for name in cfg["laws"]), check_id


# ---------------------------------------------------------------- DB: 저장·검색·변경 감지

@pytest.fixture
def test_law():
    """시험용 법령 이름·ID. 끝나면 지운다 (조문·조각은 CASCADE)."""
    from db.models import Alert, Law, LawChangeLog
    from db.session import transaction

    tag = uuid.uuid4().hex[:8]
    name = f"시험식품법{tag}"
    yield {"name": name, "key": f"T{tag}"}
    with transaction() as session:
        session.execute(delete(Law).where(Law.name == name))
        session.execute(delete(LawChangeLog).where(LawChangeLog.law_name == name))
        session.execute(delete(Alert).where(Alert.dedupe_key.like(f"law-T{tag}%")))


def make_law(info, mst, articles) -> ParsedLaw:
    law = ParsedLaw(info["key"], info["name"], "법률", mst, "1", None, "시험부처", f"https://www.law.go.kr/x/{mst}")
    for number, (title, content) in enumerate(articles, start=37):
        law.articles.append(ParsedArticle("article", number, 0, f"제{number}조", title, content, None))
    return law


@needs_db
def test_save_search_and_hybrid_ranking(test_law):
    from db.session import transaction
    from law_rag import retriever
    from law_rag.store import save_law

    emb = HashEmbedder()
    law = make_law(test_law, "100", [
        ("영업신고", "① 휴게음식점 영업을 하려는 자는 구청장에게 영업신고를 하여야 한다."),
        ("위생교육", "① 영업자는 영업 시작 전에 식품위생교육을 받아야 한다."),
        ("원산지", "① 음식점에서 쇠고기를 조리하여 판매하는 경우 원산지를 표시하여야 한다."),
    ])
    with transaction() as session:
        result = save_law(session, law, embedder=emb)
    assert result.change == "added" and result.embedded_chunks == 3

    with transaction() as session:
        hits = retriever.search(session, query="식품위생교육 받기", keywords=["교육"], names=[test_law["name"]],
                                embedder=emb, top_k=2)
        keyword_only = retriever.search(session, query="무관", keywords=["원산지"], names=[test_law["name"]], top_k=3)
        other_law = retriever.search(session, query="식품위생교육", keywords=["교육"], names=["없는법령"], embedder=emb)
        pinned = retriever.search(session, query="무관", keywords=[], names=[test_law["name"]],
                                  pins=[{"law_name": test_law["name"], "label": "제37조"}])
    assert hits[0].label == "제38조" and "vector" in hits[0].sources and "keyword" in hits[0].sources
    assert [h.label for h in keyword_only] == ["제39조"] and keyword_only[0].sources == {"keyword"}
    assert other_law == []  # 법령명 필터가 항상 걸린다
    assert [h.label for h in pinned] == ["제37조"] and pinned[0].sources == {"pinned"}

    merged = retriever.merge_by_article(hits)
    keys = [f"{a['law_name']} {a['article']}" for a in merged]
    assert len(keys) == len(set(keys))  # 판정 AI가 쓰는 키가 겹치지 않는다


@needs_db
def test_unchanged_law_is_not_reembedded_and_change_is_logged_with_history(test_law):
    from db.models import LawArticleHistory, LawChangeLog
    from db.session import transaction
    from law_rag.changes import apply_parsed

    emb = HashEmbedder()
    first = make_law(test_law, "100", [("영업신고", "① 영업신고를 하여야 한다."), ("위생교육", "① 교육을 받아야 한다.")])
    assert apply_parsed(first, emb)[0].change == "added"
    again, _ = apply_parsed(copy.deepcopy(first), emb)
    assert again.change == "unchanged" and again.embedded_chunks == 0

    second = make_law(test_law, "200", [("영업신고", "① 영업신고를 하여야 한다."), ("위생교육", "① 교육을 매년 받아야 한다.")])
    result, _ = apply_parsed(second, emb)
    assert result.change == "updated" and result.old_mst == "100" and result.new_mst == "200"
    assert result.changed_articles == [{"label": "제38조", "change": "changed"}]  # 바뀐 조문만
    assert result.embedded_chunks == 1  # 바뀐 조문만 다시 임베딩한다

    third = make_law(test_law, "300", [("영업신고", "① 영업신고를 하여야 한다.")])
    removed, _ = apply_parsed(third, emb)
    assert removed.changed_articles == [{"label": "제38조", "change": "removed"}]
    with transaction() as session:
        history = list(session.scalars(select(LawArticleHistory).where(LawArticleHistory.law_name == test_law["name"])))
        logs = list(session.scalars(select(LawChangeLog).where(LawChangeLog.law_name == test_law["name"])))
    assert {h.content for h in history} == {"① 교육을 받아야 한다.", "① 교육을 매년 받아야 한다."}
    assert [l.change_type for l in sorted(logs, key=lambda l: l.detected_at)] == ["added", "updated", "updated"]


@needs_db
def test_law_change_alerts_only_stores_with_affected_rules(test_law, monkeypatch):
    """바뀐 조문이 걸린 규칙이 적용·확인 필요인 가게에만 알림이 간다."""
    from datetime import date

    from db.models import Alert, ApplicabilityRule, LegalObligation, Store, User
    from db.session import transaction
    from law_rag.changes import apply_parsed

    emb = HashEmbedder()
    rule_id = f"T-{uuid.uuid4().hex[:6]}"
    with transaction() as session:
        session.add(ApplicabilityRule(rule_id=rule_id, title="시험 규칙", law_name=test_law["name"], article_label="제38조",
                                      pack="test"))
        user_a = User(provider="demo", name="a")
        user_b = User(provider="demo", name="b")
        session.add_all([user_a, user_b])
        session.flush()
        stores = []
        for user in (user_a, user_b):
            s = Store(user_id=user.id, name="가게", address="서울", opening_date=date(2027, 3, 2))
            session.add(s)
            stores.append(s)
        session.flush()
        affected, unaffected = stores
        session.add(LegalObligation(store_id=affected.id, rule_id=rule_id, title="시험 규칙", status="applies",
                                    reason="r", law_name=test_law["name"], article_label="제38조"))
        session.add(LegalObligation(store_id=unaffected.id, rule_id=rule_id, title="시험 규칙", status="not_applicable",
                                    reason="r", law_name=test_law["name"], article_label="제38조"))
        ids = (affected.id, unaffected.id, user_a.id, user_b.id)
    try:
        apply_parsed(make_law(test_law, "1", [("a", "① 가"), ("b", "① 나")]), emb)
        _, alerts = apply_parsed(make_law(test_law, "2", [("a", "① 가"), ("b", "① 나 개정")]), emb)
        assert alerts == 1
        with transaction() as session:
            got = list(session.scalars(select(Alert).where(Alert.store_id.in_(ids[:2]), Alert.type == "change")))
        assert [a.store_id for a in got] == [ids[0]] and test_law["name"] in got[0].title
        assert got[0].diff["changed"] == [{"label": "제38조", "change": "changed"}]
        _, again = apply_parsed(make_law(test_law, "2", [("a", "① 가"), ("b", "① 나 개정")]), emb)
        assert again == 0  # 같은 버전이면 알림이 다시 가지 않는다
    finally:
        with transaction() as session:
            session.execute(delete(ApplicabilityRule).where(ApplicabilityRule.rule_id == rule_id))
            session.execute(delete(User).where(User.id.in_(ids[2:])))  # 가게·의무사항·알림은 CASCADE


@needs_db
def test_tools_law_uses_rag_and_falls_back_when_no_stored_law(monkeypatch):
    """저장된 법령이 있으면 RAG 조문을, 없는 법령 범위면 None 이라 예전 방식으로 대체한다."""
    from law_rag.service import LawRag

    rag = LawRag(embedder=None, pack=PACK)
    found = rag.articles_for("permit_docs", store())
    stored = rag.has_data(["식품위생법"])
    if stored:
        assert found is not None and found.ok
        arts = found.data["articles"]
        assert any(a["law_name"] == "식품위생법" and a["article"] == "제37조" for a in arts)  # 고정 조문
        assert all(a["text"] and a["url"] for a in arts)
    assert rag.articles_for("no_such_check", store()) is None
    # 저장된 법령이 하나도 없는 범위는 None (소방: 다중이용업소법은 수집 전)
    if not rag.has_data(PACK["law_rag"]["checks"]["fire_safety"]["laws"]):
        assert rag.articles_for("fire_safety", store()) is None


# ---------------------------------------------------------------- API

@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as c:
        yield c


@needs_db
def test_internal_refresh_requires_token(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "internal_token", "")
    assert client.post("/api/../internal/laws/refresh".replace("/api/..", "")).status_code == 401
    monkeypatch.setattr(settings, "internal_token", "secret-token")
    assert client.post("/internal/laws/refresh", headers={"Authorization": "Bearer wrong"}).status_code == 401
    bad = client.post("/internal/laws/refresh", headers={"Authorization": "Bearer secret-token"},
                      json={"names": ["없는법"]})
    assert bad.status_code == 400
    monkeypatch.setattr("api.laws._run_refresh", lambda names: None)  # 실제 수집은 하지 않는다
    ok = client.post("/internal/laws/refresh", headers={"Authorization": "Bearer secret-token"},
                     json={"names": ["식품위생법"]})
    assert ok.status_code == 202 and ok.json() == {"status": "queued", "laws": 1}


@needs_db
def test_obligations_and_search_need_login(client):
    assert client.get("/api/laws/search", params={"q": "영업신고"}).status_code == 401
    assert client.get(f"/api/stores/{uuid.uuid4()}/obligations").status_code == 401


# ---------------------------------------------------------------- 수집기 (가짜 법제처 응답, 접속 없음)

def _collector(handler):
    import httpx

    from law_rag.collector import LawCollector

    return LawCollector(client=httpx.Client(transport=httpx.MockTransport(handler)), oc="test-oc")


def test_collector_searches_current_law_then_fetches_body_with_mst_and_effective_date():
    import httpx

    search = json.loads((MOCKS / "law_search.json").read_text(encoding="utf-8"))
    body = json.loads((MOCKS / "law_body.json").read_text(encoding="utf-8"))
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.url.path, dict(request.url.params)))
        return httpx.Response(200, json=search if request.url.path.endswith("lawSearch.do") else body)

    law = _collector(handler).fetch("식품위생법")
    assert law.name == "식품위생법" and law.mst == "285339" and law.articles
    (search_path, search_params), (service_path, service_params) = seen
    assert search_path.endswith("lawSearch.do") and search_params["query"] == "식품위생법" and search_params["OC"] == "test-oc"
    assert service_path.endswith("lawService.do")
    assert service_params["MST"] == "285339" and service_params["efYd"] == "20261008"  # 시행일 기준 조문


def test_collector_reports_unregistered_ip_clearly():
    import httpx

    from law_rag.collector import LawApiError

    denied = {"result": "사용자 정보 검증에 실패하였습니다.", "msg": "IP주소를 등록해 주세요."}
    with pytest.raises(LawApiError, match="IP"):
        _collector(lambda request: httpx.Response(200, json=denied)).fetch("식품위생법")


def test_collector_refuses_ambiguous_law_names():
    import httpx

    from law_rag.collector import LawApiError

    two = {"LawSearch": {"law": [{"법령명한글": "가법", "현행연혁코드": "현행", "법령일련번호": "1", "시행일자": "20260101"},
                                 {"법령명한글": "가법", "현행연혁코드": "현행", "법령일련번호": "2", "시행일자": "20260101"}]}}
    with pytest.raises(LawApiError, match="특정"):
        _collector(lambda request: httpx.Response(200, json=two)).fetch("가법")
