"""마이페이지 가게 정보 수정(PATCH /stores)·변경 기록(/changes)·선택 변경 재분석 (실제 PostgreSQL).

시드(seoyeon.json): 술 판매 O, 직원 O. r-01 building_use(o-1 술 빼기 / o-2 용도변경 문의→x-1 / o-3 다른 자리→x-0),
r-02 trademark_similar(o-1·o-2 이름 바꾸기 / o-3 그대로→x-2), r-03 building_violation, r-04 permit_docs.
"""

from datetime import date, timedelta
import uuid

import pytest
from sqlalchemy import delete, func, select

from config import get_settings
from db.models import ChangeLog, ChecklistItem, Run, Store
from db.session import transaction
from tests.test_runs_api import CountingTools, client, context, wait  # noqa: F401 (pytest fixture)

pytestmark = pytest.mark.skipif(not get_settings().database_url, reason="테스트 PostgreSQL 필요")


def sid_of(base: str) -> uuid.UUID:
    return uuid.UUID(base.split("/")[-1])


def run_count(base: str) -> int:
    with transaction() as session:
        return session.scalar(select(func.count()).select_from(Run).where(Run.store_id == sid_of(base)))


def checklist(client, base, headers) -> dict:
    body = client.get(base + "/checklist", headers=headers).json()
    return {i["item_id"]: i for g in body["groups"] for i in g["items"]}


def cards(client, base, headers) -> dict:
    body = client.get(base + "/report", headers=headers).json()
    return {i["item_id"]: i for g in body["groups"] for i in g["items"]}


def run_scope(client, rid, headers) -> list[str]:
    return client.get(f"/api/runs/{rid}", headers=headers).json()["scope"]


def choose(client, base, headers, item, option):
    res = client.post(f"{base}/report/items/{item}/choose", headers=headers, json={"option_id": option})
    assert res.status_code == 200, res.text
    body = res.json()
    if body["run_id"]:
        assert wait(client, body["run_id"], headers)["status"] == "done"
    return body


# ---------- 개업일·직원 여부: 외부 조회·AI 없이 ----------

def test_opening_date_only_recalculates_dates_without_analysis(context):
    client, base, headers, tools, *_ = context
    before_runs = run_count(base)
    old = checklist(client, base, headers)
    store = client.get(base, headers=headers).json()
    new_date = date.fromisoformat(store["opening_date"]) + timedelta(days=30)

    res = client.patch(base, headers=headers, json={"opening_date": new_date.isoformat()})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["impacts"] == ["dates"] and body["recomputed"] == ["checklist"]
    assert body["needs_reanalyze"] is False and body["run_id"] is None and body["reset_items"] == []
    assert body["store"] == client.get(base, headers=headers).json()
    assert body["store"]["opening_date"] == new_date.isoformat()
    assert run_count(base) == before_runs and tools.calls == []
    new = checklist(client, base, headers)
    for dates in body["checklist_dates"]["items"]:
        if dates["item_id"] in new:
            item = new[dates["item_id"]]
            assert dates == {field: item[field] for field in dates}
    for key, item in old.items():
        assert date.fromisoformat(new[key]["due_date"]) - date.fromisoformat(item["due_date"]) == timedelta(days=30)
        assert new[key]["done"] == item["done"]


def test_employee_added_creates_labor_task_and_keeps_manual_checks(context):
    client, base, headers, tools, *_ = context
    sid = sid_of(base)
    with transaction() as session:  # 직원 없이 분석한 가게: 고용 항목(c-08)이 없다
        session.get(Store, sid).has_employees = False
        session.execute(delete(ChecklistItem).where(ChecklistItem.store_id == sid, ChecklistItem.item_key == "c-08"))
    assert client.patch(base + "/checklist/c-03", headers=headers, json={"done": True}).status_code == 200
    before_runs = run_count(base)

    res = client.patch(base, headers=headers, json={"answers": {"has_employees": True}})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["impacts"] == ["checklist"] and body["needs_reanalyze"] is False and body["run_id"] is None
    assert run_count(base) == before_runs and tools.calls == []
    items = checklist(client, base, headers)
    assert "c-08" in items and items["c-08"]["category"] == "고용" and not items["c-08"]["done"]
    assert items["c-03"]["done"] and not items["c-03"]["auto_checked"]  # 수동 체크 유지

    # 다시 직원 없음: 항목은 숨겨지지만 지우지 않아 체크 상태가 남는다
    assert client.patch(base + "/checklist/c-08", headers=headers, json={"done": True}).status_code == 200
    assert client.patch(base, headers=headers, json={"answers": {"has_employees": False}}).status_code == 200
    hidden = client.get(base + "/checklist", headers=headers).json()
    assert "c-08" not in checklist(client, base, headers)
    assert any(h["category"] == "고용" for h in hidden["hidden_categories"])
    assert client.patch(base, headers=headers, json={"answers": {"has_employees": True}}).status_code == 200
    assert checklist(client, base, headers)["c-08"]["done"]


# ---------- 재분석이 필요한 수정 ----------

def test_address_change_resets_affected_cards_and_starts_scoped_run(context):
    client, base, headers, *_ = context
    choose(client, base, headers, "r-01", "o-3")  # 다른 자리 → x-0 추가 (효과 없음, 재분석 없음)
    choose(client, base, headers, "r-02", "o-3")  # 상표 그대로 → x-2 추가
    assert client.patch(base + "/checklist/c-03", headers=headers, json={"done": True}).status_code == 200

    preview = client.patch(base + "?dry_run=true", headers=headers, json={"address": "서울특별시 성동구 성수이로 99"})
    assert preview.status_code == 200 and preview.json()["dry_run"] is True and preview.json()["run_id"] is None
    assert cards(client, base, headers)["r-01"]["chosen_option"] == "o-3"  # 미리보기는 DB를 바꾸지 않는다

    res = client.patch(base, headers=headers, json={"address": "서울특별시 성동구 성수이로 99"})
    assert res.status_code == 200, res.text
    body = res.json()
    for key in ("changed", "impacts", "reset_items", "recomputed", "needs_reanalyze"):
        assert body[key] == preview.json()[key]  # 미리보기 = 실제 저장
    assert body["impacts"] == ["building", "law", "checklist"]
    assert [r["item_id"] for r in body["reset_items"]] == ["r-01"]  # 고른 카드만. r-02(상표)는 영향 밖
    assert body["reset_items"][0]["chosen_label"]
    assert body["needs_reanalyze"] is True and body["run_id"]
    assert run_scope(client, body["run_id"], headers) == ["building", "law", "checklist"]
    assert wait(client, body["run_id"], headers)["status"] == "done"

    after = cards(client, base, headers)
    assert after["r-01"]["chosen_option"] is None and after["r-02"]["chosen_option"] == "o-3"
    items = checklist(client, base, headers)
    assert "x-0" not in items and "x-2" in items  # 초기화한 카드로 생긴 항목만 사라진다
    assert items["c-03"]["done"]
    with transaction() as session:
        assert session.get(Store, sid_of(base)).address_codes is None  # 다음 분석에서 새 주소로 다시 조회


def test_address_detail_only_runs_building(context):
    client, base, headers, *_ = context
    res = client.patch(base, headers=headers, json={"address_detail": "2층"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["impacts"] == ["building"] and body["needs_reanalyze"] is True
    assert run_scope(client, body["run_id"], headers) == ["building"]
    assert wait(client, body["run_id"], headers)["status"] == "done"


def test_name_change_runs_trademark_only(context):
    client, base, headers, *_ = context
    res = client.patch(base, headers=headers, json={"name": "새이름카페"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["impacts"] == ["trademark"]
    assert run_scope(client, body["run_id"], headers) == ["trademark"]
    assert wait(client, body["run_id"], headers)["status"] == "done"


def test_multiple_fields_combine_impacts_in_one_change(context):
    client, base, headers, tools, *_ = context
    store = client.get(base, headers=headers).json()
    new_date = (date.fromisoformat(store["opening_date"]) + timedelta(days=7)).isoformat()
    res = client.patch(base, headers=headers, json={"name": "합친이름", "opening_date": new_date,
                                                    "answers": {"funds_krw": 1000}})
    assert res.status_code == 200, res.text
    body = res.json()
    assert {c["field"] for c in body["changed"]} == {"name", "opening_date", "answers.funds_krw"}
    assert set(body["impacts"]) == {"trademark", "dates", "costs"}
    assert run_scope(client, body["run_id"], headers) == ["trademark"]
    assert wait(client, body["run_id"], headers)["status"] == "done"
    assert "building" not in tools.calls
    with transaction() as session:
        assert session.scalar(select(func.count()).select_from(ChangeLog).where(ChangeLog.store_id == sid_of(base))) == 1


# ---------- 입력 오류·같은 값 ----------

def test_same_value_and_invalid_input_change_nothing(context):
    client, base, headers, *_ = context
    store = client.get(base, headers=headers).json()
    before_runs = run_count(base)
    same = client.patch(base, headers=headers, json={"name": store["name"],
                                                     "answers": {"sells_alcohol": store["answers"]["sells_alcohol"]}})
    assert same.status_code == 400 and same.json()["error"]["code"] == "INVALID_INPUT"
    for payload in ({"address": "  "}, {"name": None}, {"answers": {"has_employees": None}},
                    {"unknown": 1}, {"opening_date": "2027-02-30"}, {"owner_birth_year": 1800}):
        res = client.patch(base, headers=headers, json=payload)
        assert res.status_code == 400, payload
    assert client.get(base, headers=headers).json() == store
    assert run_count(base) == before_runs
    assert client.get(base + "/changes", headers=headers).json() == {"items": []}


# ---------- 변경 기록·알림 ----------

def test_changes_history_and_change_alerts_keep_latest_ten(context):
    client, base, headers, *_ = context
    store = client.get(base, headers=headers).json()
    start = date.fromisoformat(store["opening_date"])
    alert_ids = []
    for n in range(1, 12):
        res = client.patch(base, headers=headers, json={"opening_date": (start + timedelta(days=n)).isoformat()})
        assert res.status_code == 200
        payload = res.json()
        assert payload["removed_alert_ids"] == (alert_ids[:1] if n == 11 else [])
        alert_ids.append(payload["alert"]["alert_id"])
    items = client.get(base + "/changes", headers=headers).json()["items"]
    assert len(items) == 10
    assert items[0]["lines"][0].endswith((start + timedelta(days=11)).isoformat())  # 최신순
    assert items[0]["changed"] == [{"field": "opening_date", "from": (start + timedelta(days=10)).isoformat(),
                                    "to": (start + timedelta(days=11)).isoformat()}]
    alerts = client.get(base + "/alerts", headers=headers, params={"type": "change"}).json()["items"]
    assert len(alerts) == 10 and alerts[0]["cta"]["page"] == "mypage"
    assert alerts[0]["title"] == "가게 정보를 바꿔 다시 반영했어요"
    assert alerts[0] == payload["alert"]


# ---------- 카드 선택 변경과 재분석 ----------

def test_choice_without_value_change_does_not_reanalyze(context):
    client, base, headers, *_ = context
    before_runs = run_count(base)
    body = choose(client, base, headers, "r-01", "o-2")  # 용도변경 문의: 가게 값은 그대로
    assert body["needs_reanalyze"] is False and body["run_id"] is None
    assert run_count(base) == before_runs


def test_choice_effect_starts_reanalysis_with_scope(context):
    client, base, headers, *_ = context
    body = choose(client, base, headers, "r-01", "o-1")  # 술 빼기 → 주류 판매 예 → 아니요
    assert body["needs_reanalyze"] is True and body["run_id"]
    assert run_scope(client, body["run_id"], headers) == ["building", "law", "checklist"]
    assert client.get(base, headers=headers).json()["effective"]["answers"]["sells_alcohol"] is False


def test_removing_previous_choice_effect_starts_reanalysis(context):
    client, base, headers, *_ = context
    choose(client, base, headers, "r-01", "o-1")  # 술 빼기 (재분석 완료까지 기다림)
    body = choose(client, base, headers, "r-01", "o-2")  # 새 선택엔 효과가 없지만 술 빼기 효과가 사라진다
    assert body["needs_reanalyze"] is True and body["run_id"]
    assert any("주류 판매" in line for line in body["applied_changes"])
    assert run_scope(client, body["run_id"], headers) == ["building", "law", "checklist"]
    assert client.get(base, headers=headers).json()["effective"]["answers"]["sells_alcohol"] is True


def test_name_choice_reanalyzes_trademark(context):
    client, base, headers, *_ = context
    body = choose(client, base, headers, "r-02", "o-1")  # 이름 바꾸기
    assert run_scope(client, body["run_id"], headers) == ["trademark"]
    body = choose(client, base, headers, "r-02", "o-1")  # 같은 선택을 다시 보내면 값이 그대로라 재분석하지 않는다
    assert body["run_id"] is None


# ---------- 주소 변경 후 관할 기관 연락처 ----------

NEW_CODES = {"sigungu_cd": "11200", "bjdong_cd": "11400", "bun": "0099", "ji": "0000", "plat_gb_cd": "0"}


def building_with(tools, **update):
    original = tools.building

    def building(store):
        result = original(store)
        data = {**(result.data or {}), **update.pop("data", {})} if result.data is not None else None
        return result.model_copy(update={"data": data, **update})
    return building


def contacts(client, base, headers):
    return cards(client, base, headers)["r-01"]["contact"], checklist(client, base, headers)["c-01"]["contact"]


def test_address_change_saves_resolved_codes_and_shows_new_contact(context):
    client, base, headers, tools, *_ = context
    with transaction() as session:  # 옛 주소는 연락처가 없는 지역 → 110 기본 안내
        session.get(Store, sid_of(base)).address_codes = {"sigungu_cd": "99999", "bjdong_cd": "1", "bun": "1", "ji": "0"}
    assert contacts(client, base, headers)[0]["phone"] == "110"
    tools.building = building_with(tools, data={"address_codes": NEW_CODES})

    res = client.patch(base, headers=headers, json={"address": "서울특별시 성동구 성수이로 99"})
    assert res.status_code == 200 and res.json()["run_id"]
    assert wait(client, res.json()["run_id"], headers)["status"] == "done"
    with transaction() as session:
        assert session.get(Store, sid_of(base)).address_codes == NEW_CODES
    card_contact, task_contact = contacts(client, base, headers)
    assert card_contact["agency"] == "성동구청 건축과" and card_contact["phone"] != "110"
    assert task_contact["agency"] == "성동구청 건축과"


@pytest.mark.parametrize("update", [
    {"data": {"address_codes": NEW_CODES}, "from_mock": True},  # 모의 응답의 코드는 다른 주소의 값
    {"ok": False, "error": "외부 조회 실패"},
])
def test_address_lookup_failure_keeps_fallback_contact(context, update):
    client, base, headers, tools, *_ = context
    with transaction() as session:
        assert session.get(Store, sid_of(base)).address_codes["sigungu_cd"] == "11200"  # 시드: 성동구
    tools.building = building_with(tools, **update)

    res = client.patch(base, headers=headers, json={"address": "부산광역시 해운대구 어딘가 1"})
    assert wait(client, res.json()["run_id"], headers)["status"] == "done"
    with transaction() as session:
        assert session.get(Store, sid_of(base)).address_codes is None  # 옛 주소 코드를 되살리지 않는다
    card_contact, task_contact = contacts(client, base, headers)
    assert card_contact["phone"] == "110" and task_contact["phone"] == "110"


# ---------- 주소를 바꾸면 임대료 상권 매칭에 옛 법정동을 쓰지 않는다 (#193) ----------

def rent_area(store_row) -> tuple:
    """가게로 임대료 통계 지역을 고를 때 첫 후보 (실제 조회와 같은 주소 글자)."""
    from services import rent as rent_service
    from tools import rent as rent_tool

    return rent_tool.candidates(rent_service._address_text(store_row))[0]


def test_address_change_in_same_district_does_not_keep_old_dong_area(context):
    client, base, headers, tools, *_ = context
    with transaction() as session:  # 관악구 신림동 가게 → 신림역 상권
        row = session.get(Store, sid_of(base))
        row.address, row.region = "서울특별시 관악구 신림로 330", "서울 관악구 신림동"
        assert rent_area(row) == ("상권", "서울>기타>신림역", "full")
    # 새 주소의 법정동(봉천동)을 확인하기 전에 분석이 끝나지 않도록 건물 조회는 실패로 둔다
    tools.building = building_with(tools, ok=False, error="외부 조회 실패")

    res = client.patch(base, headers=headers, json={"address": "서울특별시 관악구 관악로 1"})
    assert res.status_code == 200 and wait(client, res.json()["run_id"], headers)["status"] == "done"
    with transaction() as session:
        row = session.get(Store, sid_of(base))
        assert row.region is None  # 옛 법정동(신림동)을 지운다
        # 새 법정동을 확인하기 전에는 이전 상권(신림역)이 아니라 서울 평균으로 비교한다
        assert rent_area(row) == ("시도", "서울", "name")


def test_address_change_fills_dong_only_from_new_address_lookup(context):
    client, base, headers, tools, *_ = context
    with transaction() as session:
        row = session.get(Store, sid_of(base))
        row.address, row.region = "서울특별시 관악구 신림로 330", "서울 관악구 신림동"
    # 재분석의 건물 조회가 새 주소를 확인하면서 법정동(봉천동)을 함께 돌려준다
    tools.building = building_with(tools, data={"address_codes": {**NEW_CODES, "region": "서울 관악구 봉천동"}})

    res = client.patch(base, headers=headers, json={"address": "서울특별시 관악구 관악로 1"})
    assert wait(client, res.json()["run_id"], headers)["status"] == "done"
    with transaction() as session:
        row = session.get(Store, sid_of(base))
        assert row.region == "서울 관악구 봉천동"
        assert rent_area(row) == ("상권", "서울>기타>서울대입구역", "full")  # 새 동의 상권, 이전 신림역이 아니다


def test_address_detail_change_keeps_dong(context):
    client, base, headers, *_ = context
    with transaction() as session:
        before = session.get(Store, sid_of(base)).region
    res = client.patch(base, headers=headers, json={"address_detail": "2층"})
    assert wait(client, res.json()["run_id"], headers)["status"] == "done"
    with transaction() as session:
        assert session.get(Store, sid_of(base)).region == before  # 층·호만 바꾸면 법정동은 그대로다


# ---------- 응답의 needs_reanalyze = 실제로 새 run을 만들었는지 ----------

def test_needs_reanalyze_matches_created_run(context):
    client, base, headers, *_ = context
    responses = []
    responses.append(choose(client, base, headers, "r-02", "o-1"))  # 이름 바꾸기 → run
    responses.append(choose(client, base, headers, "r-02", "o-1"))  # 같은 선택 → run 없음
    responses.append(choose(client, base, headers, "r-01", "o-2"))  # 효과 없음 → run 없음
    store = client.get(base, headers=headers).json()
    new_date = (date.fromisoformat(store["opening_date"]) + timedelta(days=1)).isoformat()
    responses.append(client.patch(base, headers=headers, json={"opening_date": new_date}).json())
    res = client.patch(base, headers=headers, json={"address_detail": "3층"}).json()
    assert wait(client, res["run_id"], headers)["status"] == "done"
    responses.append(res)

    for body in responses:
        assert body["needs_reanalyze"] == (body["run_id"] is not None)
        if body["run_id"]:
            with transaction() as session:
                assert session.get(Run, uuid.UUID(body["run_id"])).trigger == "user"
    assert [b["needs_reanalyze"] for b in responses] == [True, False, False, False, True]
    # 선택지에 AI가 붙인 apply.needs_reanalyze(안내)는 그대로 두고, 최종 값과 섞지 않는다
    option = next(o for o in cards(client, base, headers)["r-02"]["options"] if o["option_id"] == "o-1")
    assert option["apply"]["needs_reanalyze"] is True and responses[1]["needs_reanalyze"] is False


# ---------- 업종 검증 (#105): 등록과 같은 규칙, 미리보기·저장 모두 400 ----------

def store_snapshot(client, base, headers):
    """가게 정보·변경 기록·change 알림·분석 run 수."""
    from db.models import Alert
    sid = sid_of(base)
    with transaction() as session:
        logs = session.scalar(select(func.count()).select_from(ChangeLog).where(ChangeLog.store_id == sid))
        alerts = session.scalar(select(func.count()).select_from(Alert).where(Alert.store_id == sid,
                                                                           Alert.type == "change"))
    return client.get(base, headers=headers).json(), logs, alerts, run_count(base)


@pytest.mark.parametrize("payload", [
    {"business_type_input": "술집"},
    {"business_type_input": "카페 프랜차이즈"},
    {"business_type_input": "술집", "name": "같이 바꾸려던 이름"},  # 다른 필드와 함께 보내도 아무것도 저장하지 않는다
])
def test_unsupported_business_type_is_400_for_preview_and_save(context, payload):
    client, base, headers, *_ = context
    before = store_snapshot(client, base, headers)
    for query in ("?dry_run=true", ""):
        res = client.patch(base + query, headers=headers, json=payload)
        assert res.status_code == 400, (query, res.text)
        assert res.json()["error"]["code"] == "INVALID_INPUT" and "카페" in res.json()["error"]["message"]
    assert store_snapshot(client, base, headers) == before  # 가게 정보·변경 기록·알림·run 그대로


def test_business_type_is_validated_before_run_in_progress_check(context, monkeypatch):
    from tests.test_runs_api import blocked, start
    client, base, headers, _, manager, _ = context
    with blocked(manager, monkeypatch) as (entered, release):
        rid = start(context)
        assert entered.wait(2)
        bad = client.patch(base, headers=headers, json={"business_type_input": "술집"})
        assert bad.status_code == 400  # 입력 오류는 분석 중이어도 400
        good = client.patch(base, headers=headers, json={"business_type_input": "음식점"})
        assert good.status_code == 409  # 올바른 값은 분석 중이면 409 (저장 안 함)
        release.set()
        assert wait(client, rid, headers)["status"] == "done"
    assert client.get(base, headers=headers).json()["business_type_input"] == "카페"


def test_supported_business_type_change_computes_impacts(context):
    client, base, headers, *_ = context
    assert client.get(base, headers=headers).json()["business_type_input"] == "카페"
    preview = client.patch(base + "?dry_run=true", headers=headers, json={"business_type_input": "음식점"})
    assert preview.status_code == 200, preview.text
    assert preview.json()["impacts"] == ["building", "law", "checklist"]
    assert preview.json()["changed"] == [{"field": "business_type_input", "from": "카페", "to": "음식점"}]

    res = client.patch(base, headers=headers, json={"business_type_input": "음식점"})
    assert res.status_code == 200, res.text
    body = res.json()
    for key in ("changed", "impacts", "reset_items", "recomputed"):
        assert body[key] == preview.json()[key]
    assert body["needs_reanalyze"] is True and body["run_id"]
    assert run_scope(client, body["run_id"], headers) == ["building", "law", "checklist"]
    assert wait(client, body["run_id"], headers)["status"] == "done"
    assert client.get(base, headers=headers).json()["business_type_input"] == "음식점"
    lines = client.get(base + "/changes", headers=headers).json()["items"][0]["lines"]
    assert lines[0] == "업종: 카페 → 음식점"


def test_register_and_update_reject_with_same_rule(context, monkeypatch):
    """등록(POST /stores)과 수정(PATCH /stores)이 같은 업종 목록·메시지로 거절한다."""
    import uuid as _uuid
    from db.models import User
    from services import store_register
    from services.auth import issue_token
    from services.pack import get_pack

    client, base, headers, *_ = context
    allowed = store_register.supported_business_types(get_pack())
    assert allowed == ["카페", "음식점"]
    patch_error = client.patch(base, headers=headers, json={"business_type_input": "술집"}).json()["error"]

    monkeypatch.setattr(store_register, "question_llm", lambda: None)
    with transaction() as session:
        user = User(provider="kakao", provider_user_id=str(_uuid.uuid4()), name="t")
        session.add(user)
        session.flush()
        uid = user.id
    try:
        new_headers = {"Authorization": f"Bearer {issue_token(str(uid))}"}
        body = {"name": "새가게", "address": "서울 성동구 성수이로 1", "opening_date": "2027-06-01"}
        post_error = client.post("/api/stores", headers=new_headers,
                                 json={**body, "business_type_input": "술집"}).json()["error"]
        assert post_error == patch_error
        for value in allowed:  # 지원 업종은 등록에서도 통과
            res = client.post("/api/stores", headers=new_headers, json={**body, "business_type_input": value})
            assert res.status_code in (201, 409)
    finally:
        with transaction() as session:
            session.execute(delete(User).where(User.id == uid))
