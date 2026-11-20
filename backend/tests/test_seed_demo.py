"""예시 계정 시드 변환 테스트 (DB 없이 실행)."""

from datetime import date

import pytest

from config import sqlalchemy_url
from db.seed_demo import build_demo_rows, load_demo, load_rules


@pytest.fixture(scope="module")
def demo():
    return load_demo()


@pytest.fixture(scope="module")
def rows(demo):
    return build_demo_rows(demo, load_rules())


def test_row_counts(demo, rows):
    assert len(rows.report_items) == len(demo["report_items"]) == 4
    assert len(rows.checklist_items) == len(demo["checklist"]) == 9


def test_item_key_mapping(demo, rows):
    assert [r["item_key"] for r in rows.report_items] == [r["item_id"] for r in demo["report_items"]]
    assert [c["item_key"] for c in rows.checklist_items] == [c["item_id"] for c in demo["checklist"]]
    assert all("item_id" not in r for r in rows.report_items + rows.checklist_items)
    assert all("report_item_id" not in c for c in rows.checklist_items)


def test_store_answers_expanded(rows):
    s = rows.store
    assert (s["sells_alcohol"], s["uses_terrace"], s["has_employees"], s["funds_krw"]) == (True, False, True, 40_000_000)
    assert "answers" not in s and "menu_text" not in s
    assert s["is_demo"] is True
    assert s["opening_date"] == date(2027, 3, 2)
    assert rows.user == {"provider": "demo", "provider_user_id": None, "name": "이서연"}


def test_offset_days(rows):
    by_key = {c["item_key"]: c for c in rows.checklist_items}
    assert by_key["c-01"]["offset_days"] == -56  # 2027-01-05 → 2027-03-02
    for c in rows.checklist_items:
        assert c["offset_days"] == (c["due_date"] - rows.store["opening_date"]).days


def test_done_items(rows):
    done = {c["item_key"]: c["task"] for c in rows.checklist_items if c["done"]}
    assert done == {"c-02": "위생교육 신청", "c-05": "사업자등록"}
    assert not any(c["auto_checked"] for c in rows.checklist_items)


def test_initial_card_state(rows):
    assert all(r["chosen_option"] is None and r["action_status"] == "pending" for r in rows.report_items)


def test_decision_alerts(rows):
    keys = [a["dedupe_key"] for a in rows.alerts]
    assert keys == ["dec-r-01", "dec-r-04"]
    assert all(a["type"] == "decision" for a in rows.alerts)
    assert all(a["cta"]["item_id"] == a["dedupe_key"][4:] for a in rows.alerts)


def test_evidence_flags_kept(demo, rows):
    assert rows.report_items[0]["evidence"] == demo["report_items"][0]["evidence"]
    assert any(e.get("from_mock") for r in rows.report_items for e in r["evidence"])


def test_values_fit_db_checks(rows):
    for r in rows.report_items:
        assert r["stage"] in ("계약 전", "개업 전", "운영 중")
        assert r["verdict"] in ("high", "low", "unknown", "ok")
        assert r["decided_by"] in ("rule", "ai")
    for c in rows.checklist_items:
        assert c["source"] in ("rule", "report", "grant")
        assert c["category"] in ("영업 인허가", "세무", "고용", "건물·시설", "간판·광고", "표시 의무", "정책")
        assert c["group_label"] in ("계약 전", "개업 4주 전", "개업 직전", "개업 후")
    assert rows.store["business_type_input"] in ("카페", "음식점")


def test_sqlalchemy_url():
    assert sqlalchemy_url("postgresql://u:p@h:1/d") == "postgresql+psycopg://u:p@h:1/d"
    assert sqlalchemy_url("postgres://u:p@h:1/d") == "postgresql+psycopg://u:p@h:1/d"
    assert sqlalchemy_url("postgresql+psycopg://h/d") == "postgresql+psycopg://h/d"


def test_options_follow_public_contract(rows):
    r01 = next(r for r in rows.report_items if r["item_key"] == "r-01")
    ids = [o["option_id"] for o in r01["options"]]
    assert ids == ["o-1", "o-3"]  # set_main_site(후보 자리) 선택지는 뺀다
    assert all("site_id" not in o for r in rows.report_items for o in r["options"])
    by_id = {o["option_id"]: o for o in r01["options"]}
    assert by_id["o-3"]["apply"]["adds_checklist"] == ["x-1"]  # request_use_change → x-1
    assert "adds_checklist" not in by_id["o-1"]["apply"]
    r04 = next(r for r in rows.report_items if r["item_key"] == "r-04")
    proceed = next(o for o in r04["options"] if o["remedy"] == "proceed")
    assert proceed["apply"]["adds_checklist"] == ["x-2"]
    assert rows.skipped["options"] == ["r-01/o-2"]


def test_demo_run_keeps_events(demo, rows):
    assert rows.run["trigger"] == "demo" and rows.run["status"] == "done"
    assert rows.run["events"] == demo["events"]
