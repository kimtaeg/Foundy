"""알림 시점 이동(as_of) 예시 알림.

단위 테스트(DB 없음)와 실제 PostgreSQL API 테스트. 시드(seoyeon.json): 개업 2027-03-02, c-03·c-05 완료, 직원 O.
체크리스트 기한: c-01 01-05, c-02 01-12, c-03 02-02, c-04 02-02, c-05 02-08, c-06 02-20, c-07 02-24, c-08 02-27, c-09 03-09.
"""

from datetime import date
from types import SimpleNamespace
import re
import uuid

import pytest
from sqlalchemy import delete, func, select

from config import get_settings
from services.example_alerts import add_months, after_opening_alerts, deadline_alerts

D7 = "2027-02-23"  # 개업 D-7
AFTER_6M = "2027-09-02"  # 개업일 + 달력상 6개월
ISO_KST = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$")


# ---------- 단위 (DB 없음) ----------

def task(key, due, done=False, category="영업 인허가", agency="기관"):
    return SimpleNamespace(item_key=key, task=f"할 일 {key}", due_date=date.fromisoformat(due), done=done,
                           category=category, agency=agency, rule_key=key)


def titles(rows):
    return [r["cta"]["item_id"] for r in rows]


def test_deadline_window_includes_overdue_and_14th_day_but_not_15th():
    items = [task("past", "2027-01-01"), task("today", "2027-02-23"), task("d14", "2027-03-09"),
             task("d15", "2027-03-10"), task("done", "2027-02-01", done=True)]
    rows = deadline_alerts(items, date(2027, 2, 23), set(), lambda i: i.task)
    assert titles(rows) == ["past", "today", "d14"]
    assert [r["title"].split("” ")[1] for r in rows] == ["기한 53일 지남", "오늘 마감", "D-14"]
    assert all(r["is_example"] and r["type"] == "deadline" and not r["read"] for r in rows)
    assert rows[0]["cta"] == {"label": "체크리스트 열기", "page": "checklist", "item_id": "past"}
    assert rows[0]["alert_id"] == "ex-dl-past" and ISO_KST.match(rows[0]["created_at"])


def test_deadline_skips_hidden_categories():
    items = [task("c-08", "2027-02-27", category="고용"), task("c-04", "2027-02-02")]
    assert titles(deadline_alerts(items, date(2027, 2, 23), {"고용"}, lambda i: i.task)) == ["c-04"]


@pytest.mark.parametrize("start,expected", [
    ("2027-03-02", "2027-09-02"),
    ("2027-08-31", "2028-02-29"),  # 윤년 2월 말일
    ("2026-08-31", "2027-02-28"),  # 평년 2월 말일
    ("2027-12-31", "2028-06-30"),  # 30일까지인 달, 해 넘김
])
def test_add_months_uses_month_end_when_day_missing(start, expected):
    assert add_months(date.fromisoformat(start), 6) == date.fromisoformat(expected)


def test_after_opening_alerts_start_exactly_six_calendar_months_later():
    opening = date(2026, 8, 31)
    assert after_opening_alerts(opening, date(2027, 2, 27)) == []
    rows = after_opening_alerts(opening, date(2027, 2, 28))  # 8/31 + 6개월 → 2/28 (말일)
    assert [r["alert_id"] for r in rows] == ["ex-vat", "ex-hygiene"]


def test_after_opening_mock_has_no_invented_dates_and_points_to_official_guides():
    vat, hygiene = after_opening_alerts(date(2027, 3, 2), date(2027, 9, 2))
    for row in (vat, hygiene):
        assert row["is_example"] and row["type"] == "deadline" and ISO_KST.match(row["created_at"])
        assert not re.search(r"\d{1,2}월|\d{1,2}일|\d{4}-\d{2}", row["title"] + row["body"])  # 날짜를 지어내지 않는다
    assert "홈택스" in vat["body"] and "확인하세요" in vat["body"]
    assert vat["cta"] == {"label": "체크리스트 열기", "page": "checklist"}  # 사업자등록(c-03)으로 보내지 않는다
    assert "확인하세요" in hygiene["body"] and hygiene["cta"]["item_id"] == "c-05"


# ---------- API (실제 PostgreSQL) ----------

db = pytest.mark.skipif(not get_settings().database_url, reason="테스트 PostgreSQL 필요")


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def demo(client):
    from db.models import User
    from db.session import transaction

    body = client.post("/api/demo").json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    base = f"/api/stores/{body['store_id']}"

    def get(params=None):
        res = client.get(base + "/alerts", headers=headers, params=params)
        assert res.status_code == 200, res.text
        return res.json()

    get.client, get.base, get.headers, get.store_id = client, base, headers, uuid.UUID(body["store_id"])
    yield get
    with transaction() as session:
        session.execute(delete(User).where(User.id == uuid.UUID(body["user"]["user_id"])))


def simulated(alert):
    """시점 이동 예시 알림. 데모 시드의 저장 알림도 is_example 이라 저장되지 않는 id(ex-)로 구별한다."""
    return alert["alert_id"].startswith("ex-")


def example_ids(body):
    return [a["cta"].get("item_id") or a["alert_id"] for a in body["items"] if simulated(a)]


def alert_rows(store_id):
    from db.models import Alert
    from db.session import transaction

    with transaction() as session:
        return session.scalar(select(func.count()).select_from(Alert).where(Alert.store_id == store_id))


@db
def test_without_as_of_behaves_as_before(demo):
    body = demo()
    from services.timeutil import today_kst
    assert body["as_of"] == today_kst().isoformat()
    assert body["items"] and not any(simulated(a) for a in body["items"])
    assert {a["type"] for a in body["items"]} == {"decision"}
    first = body["items"][0]
    res = demo.client.patch(f"{demo.base}/alerts/{first['alert_id']}", headers=demo.headers, json={"read": True})
    assert res.status_code == 200 and res.json()["read"] is True
    assert next(a for a in demo()["items"] if a["alert_id"] == first["alert_id"])["read"] is True


@db
def test_d7_shows_overdue_and_upcoming_undone_tasks_before_stored_alerts(demo):
    body = demo({"as_of": D7})
    assert body["as_of"] == D7
    assert example_ids(body) == ["c-01", "c-02", "c-04", "c-06", "c-07", "c-08", "c-09"]  # c-03·c-05 완료 제외
    examples = [a for a in body["items"] if simulated(a)]
    assert body["items"][:len(examples)] == examples  # 예시가 앞, 실제 알림이 뒤
    assert [a["type"] for a in body["items"][len(examples):]] == ["decision", "decision"]
    assert all(a["is_example"] and a["cta"]["page"] == "checklist" and ISO_KST.match(a["created_at"]) for a in examples)
    assert examples[-1]["title"].endswith("D-14")  # c-09: 정확히 14일 뒤
    assert "c-09" not in example_ids(demo({"as_of": "2027-02-22"}))  # 하루 앞당기면 15일 뒤라 빠진다


@db
def test_d7_reflects_current_checklist_state(demo):
    assert demo.client.patch(f"{demo.base}/checklist/c-07", headers=demo.headers, json={"done": True}).status_code == 200
    assert demo.client.patch(f"{demo.base}/checklist/c-03", headers=demo.headers, json={"done": False}).status_code == 200
    ids = example_ids(demo({"as_of": D7}))
    assert "c-07" not in ids and "c-03" in ids
    from db.models import Store
    from db.session import transaction
    with transaction() as session:
        session.get(Store, demo.store_id).has_employees = False  # 고용 카테고리 숨김
    assert "c-08" not in example_ids(demo({"as_of": D7}))


@db
def test_after_six_months_adds_mock_alerts_with_deadlines(demo):
    body = demo({"as_of": AFTER_6M})
    ids = example_ids(body)
    assert ids[-2:] == ["ex-vat", "c-05"]  # 부가세(체크리스트 목록), 위생교육 갱신(c-05)
    assert ids[:-2] == ["c-01", "c-02", "c-04", "c-06", "c-07", "c-08", "c-09"]  # 끝내지 못한 항목은 기한 지남
    assert all("지남" in a["title"] for a in body["items"][:7])
    assert "ex-vat" not in example_ids(demo({"as_of": "2027-09-01"}))  # 하루 전에는 없다


@db
def test_type_filter_applies_to_examples(demo):
    deadline = demo({"as_of": AFTER_6M, "type": "deadline"})["items"]
    assert deadline and all(a["type"] == "deadline" and simulated(a) and a["is_example"] for a in deadline)
    decision = demo({"as_of": AFTER_6M, "type": "decision"})["items"]
    assert decision and not any(simulated(a) for a in decision)


@db
@pytest.mark.parametrize("value", ["2027-02-30", "abc", "2027/02/23"])
def test_invalid_as_of_is_rejected(demo, value):
    res = demo.client.get(demo.base + "/alerts", headers=demo.headers, params={"as_of": value})
    assert res.status_code == 400 and res.json()["error"]["code"] == "INVALID_INPUT"


@db
def test_examples_are_never_stored(demo):
    before_rows = alert_rows(demo.store_id)
    before_unread = demo.client.get(demo.base + "/dashboard", headers=demo.headers).json()["alerts"]["unread"]
    body = demo({"as_of": AFTER_6M})
    assert alert_rows(demo.store_id) == before_rows
    assert demo.client.get(demo.base + "/dashboard", headers=demo.headers).json()["alerts"]["unread"] == before_unread
    assert not any(simulated(a) for a in demo()["items"])
    example = next(a for a in body["items"] if simulated(a))
    res = demo.client.patch(f"{demo.base}/alerts/{example['alert_id']}", headers=demo.headers, json={"read": True})
    assert res.status_code == 404
