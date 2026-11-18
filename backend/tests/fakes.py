"""분석 루프 테스트용 가짜 도구·계산·가게. 실제 tools/·calc/ 구현 없이 AI 파트만 검증한다."""

from __future__ import annotations

from datetime import date, timedelta

from agent.advise import AdviceDraft, DraftText, OptionSummary
from agent.judge import AdJudgment, TrademarkJudgment
from agent.ports import Site, StoreInput, ToolResult
from agent.questions import QuestionPick


def store(**kw) -> StoreInput:
    base = dict(store_id="s1", name="모노커피", address="서울 성동구 성수이로 00", address_detail="1층",
                opening_date=date(2027, 3, 2),
                answers={"sells_alcohol": True, "uses_terrace": False, "has_employees": True})
    base.update(kw)
    return StoreInput(**base)


class FakeTools:
    def __init__(self, uses=("제1종근린생활시설",), violation=None, similar=(), building_ok=True,
                 trademark_ok=True, law_ok=True, raises=False):
        self.uses, self.violation, self.similar = list(uses), violation, list(similar)
        self.building_ok, self.trademark_ok, self.law_ok, self.raises = building_ok, trademark_ok, law_ok, raises

    def building(self, store):
        if self.raises:
            raise RuntimeError("boom")
        if not self.building_ok:
            return ToolResult(ok=False, source="건축물대장", error="timeout")
        return ToolResult(ok=True, source="건축물대장 층별개요",
                          data={"floor_uses": self.uses, "violation": self.violation})

    def trademark(self, name):
        if not self.trademark_ok:
            return ToolResult(ok=False, source="KIPRIS", error="down")
        return ToolResult(ok=True, source="KIPRIS", from_mock=True, data={"similar": self.similar})

    def law(self, check_id):
        if not self.law_ok:
            return ToolResult(ok=False, source="국가법령정보", error="ip blocked")
        return ToolResult(ok=True, source="국가법령정보", data={"articles": [
            {"law_name": "건축법 시행령", "article": "별표 1", "text": "...", "url": "https://www.law.go.kr/x"}]})


class FakeCalc:
    def checklist_dates(self, opening_date, week):
        label = "계약 전" if week <= -8 else "개업 4주 전" if week <= -4 else "개업 직전" if week < 0 else "개업 후"
        return {"due_date": opening_date + timedelta(weeks=week), "dday": week * 7, "group_label": label}

    def site_cost_delta(self, base, other):
        try:
            return {"initial_delta_krw": other["deposit_krw"] - base["deposit_krw"],
                    "monthly_delta_krw": other["monthly_rent_krw"] - base["monthly_rent_krw"]}
        except KeyError:
            return None


def site_b(**kw) -> Site:
    base = dict(site_id="st-02", label="B", floor_uses=["제2종근린생활시설"],
                listing={"deposit_krw": 34_000_000, "monthly_rent_krw": 2_800_000})
    base.update(kw)
    return Site(**base)


MAIN_SITE = Site(site_id="st-01", label="A", floor_uses=["제1종근린생활시설"], is_main=True,
                 listing={"deposit_krw": 30_000_000, "monthly_rent_krw": 2_500_000})

SIMILAR = [{"reg_no": "4000000000001", "name": "모노 커피", "class_code": "43", "status": "등록",
            "url": "https://kipris/x"}]

BUILDING_ADVICE = AdviceDraft(
    consequence="이대로 계약하면 영업신고가 반려돼 보증금이 묶일 수 있어요.",
    option_summaries=[OptionSummary(option_id="o-1", summary="술 없이 카페로 시작해요.")],
    recommended_option_id="o-2", recommendation_reason="술 매출을 포기하지 않아도 돼요.",
    drafts=[DraftText(kind="inquiry_message", title="구청 건축과 문의 문자", body="성수이로 00 1층의 용도를 확인하고 싶어요."),
            DraftText(kind="contract_clause", title="임대차 특약 문구", body="일반음식점 신고가 불가능하면 계약을 해지할 수 있다.")],
    user_action_text="구청에 문의 문자 보내기", user_action_type="send", user_action_est_minutes=1,
    user_action_draft_kind="inquiry_message")

VIOLATION_ADVICE = AdviceDraft(
    consequence="위반건축물이면 영업신고가 반려될 수 있어요.",
    drafts=[DraftText(kind="inquiry_message", title="위반건축물 문의", body="위반건축물 여부를 확인하고 싶어요.")],
    user_action_text="구청에 문의 문자 보내기", user_action_type="send", user_action_draft_kind="inquiry_message")

TM_JUDGMENT = TrademarkJudgment(verdict="low", title="'모노커피'와 비슷한 상표가 있어요",
                                reason="발음이 비슷한 등록 상표가 있어요.", cited_reg_nos=["4000000000001"],
                                alternatives=["하루커피", "달빛커피", "셋째"])
TM_ADVICE = AdviceDraft(consequence="간판을 만든 뒤 문제되면 바꿔야 할 수 있어요.",
                        recommended_option_id="o-1", recommendation_reason="지금 바꾸는 비용이 가장 낮아요.",
                        user_action_text="이름을 바꿀지 정하기", user_action_type="decide")


# ---- 시나리오 JSON → 가짜 도구·LLM ----
def scenario_llm(canned: dict) -> "FakeLLM":
    from agent.llm import FakeLLM

    models = {"judge_trademark": TrademarkJudgment, "judge_ad_claims": AdJudgment, "ask": QuestionPick}
    out = {}
    for step, body in canned.items():
        out[step] = (models.get(step) or AdviceDraft).model_validate(body)
    return FakeLLM(out)


class JsonTools:
    """mocks/demo/*_inputs.json의 tools 부분을 그대로 돌려주는 도구 (예시 데이터 시연·mock 모드용)."""

    def __init__(self, spec: dict):
        self.spec = spec

    def building(self, store):
        return ToolResult(**self.spec["building"])

    def trademark(self, name):
        return ToolResult(**self.spec["trademark"])

    def grants(self, store):
        return ToolResult(**self.spec["grants"])

    def law(self, check_id):
        r = self.spec.get("law", {}).get(check_id)
        return ToolResult(**r) if r else ToolResult(ok=False, source="국가법령정보", error="mock 없음")


def _date_info(self, opening_date, due_date):
    dday = (due_date - opening_date).days
    label = "계약 전" if dday <= -56 else "개업 4주 전" if dday <= -28 else "개업 직전" if dday < 0 else "개업 후"
    return {"due_date": due_date, "dday": dday, "group_label": label}


FakeCalc.date_info = _date_info
