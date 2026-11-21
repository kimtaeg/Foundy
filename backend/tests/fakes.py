"""분석 루프 테스트용 가짜 도구·계산·가게. 실제 tools/·calc/ 구현 없이 AI 파트만 검증한다."""

from __future__ import annotations

from datetime import date, timedelta

from agent.advise import AdviceDraft, OptionSummary
import json
import re

from agent.judge import (
    AdJudgment, BuildingJudgment, PermitJudgment, TrademarkJudgment, ViolationJudgment,
)
from agent.ports import StoreInput, ToolResult
from agent.questions import QuestionPick


def store(**kw) -> StoreInput:
    base = dict(store_id="s1", name="모노커피", address="서울 성동구 성수이로 00", address_detail="1층",
                address_codes={"sigungu_cd": "11200"},
                opening_date=date(2027, 3, 2),
                answers={"sells_alcohol": True, "uses_terrace": False, "has_employees": True},
                area_sqm=40.0)  # 제1종 시설의 휴게음식점은 면적 300㎡ 미만 확인이 필요해, 기본은 작은 가게로 둔다
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

    def law(self, check_id, store=None):
        if not self.law_ok:
            return ToolResult(ok=False, source="국가법령정보", error="ip blocked")
        if check_id == "labeling":
            return ToolResult(ok=True, source="국가법령정보", data={"articles": []})  # 읽을 조문이 없으면 일반 안내
        if check_id == "building_use":
            return ToolResult(ok=True, source="국가법령정보", data={"articles": [
                {"law_name": "건축법 시행령", "article": "별표 1", "text": BYUL_1, "url": "https://www.law.go.kr/x"}]})
        if check_id == "permit_docs":
            return ToolResult(ok=True, source="국가법령정보", data={"articles": [
                {"law_name": "식품위생법", "article": "제37조", "text": ARTICLE_37, "url": "https://www.law.go.kr/법령/식품위생법"}]})
        if check_id == "labor_contract":
            return ToolResult(ok=True, source="국가법령정보", data={"articles": [
                {"law_name": "근로기준법", "article": "제17조", "text": LABOR_17, "url": LABOR_17_URL}]})
        return ToolResult(ok=True, source="국가법령정보", data={"articles": [
            {"law_name": "건축법 시행령", "article": "별표 1", "text": "...", "url": "https://www.law.go.kr/x"}]})


class FakeCalc:
    """실제 calc/dates.py와 같은 계산을 쓰는 가짜 계산 도구."""

    def checklist_dates(self, opening_date, offset_days):
        from calc.dates import checklist_dates

        return checklist_dates(opening_date, offset_days)

    def date_info(self, opening_date, due_date):
        from calc.dates import date_info

        return date_info(opening_date, due_date)


# 건축법 시행령 별표 1 (테스트용 요약 문구. 실제 원문은 법령 API가 준다)
BYUL_1 = ("제1종 근린생활시설: 휴게음식점은 같은 건축물에서 해당 용도로 쓰는 바닥면적의 합계가 300제곱미터 미만인 것. "
          "제2종 근린생활시설: 일반음식점. 제1종 근린생활시설에서는 일반음식점을 할 수 없다.")


def building_ai(user: str) -> BuildingJudgment:
    """테스트용 AI 대역: 프롬프트의 층 용도와 업종을 읽고 별표 문구와 같은 방향으로 판정한다."""
    biz = re.search(r"\(business_type\): (\S+)", user).group(1)
    uses = json.loads(re.search(r"\(floor_uses\): (\[.*?\])\n", user).group(1))
    use = uses[0] if uses else ""
    kind = "제1종" if "제1종" in use else "제2종" if "제2종" in use else None
    q = "제1종 근린생활시설에서는 일반음식점을 할 수 없다" if kind == "제1종" else "제2종 근린생활시설: 일반음식점"
    if kind is None:
        return BuildingJudgment(verdict="unknown", title="건물 용도를 확인할 수 없어요", reason="용도를 판단할 수 없어요")
    ok = not (kind == "제1종" and biz == "일반음식점")
    oks = ["휴게음식점", "일반음식점"] if kind == "제2종" else ["휴게음식점"]
    t = f"이 건물에서 {biz} 신고가 가능해요" if ok else f"이 자리에서는 {biz} 신고가 어려워요"
    return BuildingJudgment(verdict="ok" if ok else "high", title=t, reason=f"이 층은 {use}이에요.", cited_uses=[use],
                            cited=["건축법 시행령 별표 1"], quotes=[q], ok_business_types=oks)


def violation_ai(user: str) -> ViolationJudgment:
    v = re.search(r"\(violation\): (\S+)", user).group(1) == "true"
    return ViolationJudgment(verdict="high" if v else "ok", title="위반건축물로 표기된 건물이에요" if v else "위반건축물 표기가 없어요",
                             reason="건축물대장 표기를 읽었어요.")


AI_JUDGES = {"judge_building_use": building_ai, "judge_violation": violation_ai}

# 식품위생법 제37조 제4항 (mocks/law_article37.json의 실제 조문 일부)
ARTICLE_37 = ("④ 제36조제1항 각 호에 따른 영업 중 대통령령으로 정하는 영업을 하려는 자는 대통령령으로 정하는 바에 따라 영업 종류별 또는 "
              "영업소별로 식품의약품안전처장 또는 특별자치시장ㆍ특별자치도지사ㆍ시장ㆍ군수ㆍ구청장에게 신고하여야 한다.")

# 근로기준법 제17조(근로조건의 명시) 원문. 2026-11-21 법제처 국가법령정보 공동활용 API(lawService, 현행)에서 받은 그대로다.
# 테스트 중에는 법령 API를 부르지 않도록 고정 픽스처로 둔다.
LABOR_17_URL = "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=285279"
LABOR_17 = (
    "① 사용자는 근로계약을 체결할 때에 근로자에게 다음 각 호의 사항을 명시하여야 한다. 근로계약 체결 후 다음 각 호의 사항을 변경하는 경우에도 또한 같다. <개정 2010.5.25>\n"
    "1. 임금\n2. 소정근로시간\n3. 제55조에 따른 휴일\n4. 제60조에 따른 연차 유급휴가\n5. 그 밖에 대통령령으로 정하는 근로조건\n"
    "② 사용자는 제1항제1호와 관련한 임금의 구성항목ㆍ계산방법ㆍ지급방법 및 제2호부터 제4호까지의 사항이 명시된 서면(「전자문서 및 전자거래 기본법」 "
    "제2조제1호에 따른 전자문서를 포함한다)을 근로자에게 교부하여야 한다. 다만, 본문에 따른 사항이 단체협약 또는 취업규칙의 변경 등 대통령령으로 정하는 "
    "사유로 인하여 변경되는 경우에는 근로자의 요구가 있으면 그 근로자에게 교부하여야 한다. <신설 2010.5.25, 2021.1.5>\n"
    "제17조(근로조건의 명시)")

PERMIT_JUDGMENT = PermitJudgment(
    verdict="low", title="영업신고를 개업 전에 해야 해요",
    reason="음식점 영업은 시장·군수·구청장에게 신고해야 하는 영업에 해당할 수 있어요.",
    required=["영업신고서 작성·제출", "구청 위생과에 필요 서류 확인"], cited=["식품위생법 제37조"],
    quotes=["대통령령으로 정하는 영업을 하려는 자는 대통령령으로 정하는 바에 따라 영업 종류별 또는 영업소별로"])

SIMILAR = [{"reg_no": "4000000000001", "name": "모노 커피", "class_code": "43", "status": "등록",
            "url": "https://kipris/x"}]

BUILDING_ADVICE = AdviceDraft(
    consequence="이대로 계약하면 영업신고가 반려돼 보증금이 묶일 수 있어요.",
    option_summaries=[OptionSummary(option_id="o-1", summary="술 없이 카페로 시작해요.")],
    recommended_option_id="o-2", recommendation_reason="술 매출을 포기하지 않아도 돼요.",
    user_action_text="구청 건축과에 전화로 문의하기", user_action_type="send", user_action_est_minutes=3)

TM_JUDGMENT = TrademarkJudgment(verdict="low", title="'모노커피'와 비슷한 상표가 있어요",
                                reason="발음이 비슷한 등록 상표가 있어요.", cited_reg_nos=["4000000000001"],
                                alternatives=["하루커피", "달빛커피", "셋째"])
TM_ADVICE = AdviceDraft(consequence="간판을 만든 뒤 문제되면 바꿔야 할 수 있어요.",
                        recommended_option_id="o-1", recommendation_reason="지금 바꾸는 비용이 가장 낮아요.",
                        user_action_text="이름을 바꿀지 정하기", user_action_type="decide")


# ---- 시나리오 JSON → 가짜 도구·LLM ----
def scenario_llm(canned: dict) -> "FakeLLM":
    from agent.llm import FakeLLM

    models = {"judge_trademark": TrademarkJudgment, "judge_ad_claims": AdJudgment, "ask": QuestionPick,
              "judge_permit_docs": PermitJudgment, "judge_law_card": PermitJudgment}
    out = {"judge_permit_docs": PERMIT_JUDGMENT, "judge_law_card": PERMIT_JUDGMENT, **AI_JUDGES}  # 시나리오 JSON에 없으면 기본 판정을 쓴다
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

    def law(self, check_id, store=None):
        r = self.spec.get("law", {}).get(check_id)
        return ToolResult(**r) if r else ToolResult(ok=False, source="국가법령정보", error="mock 없음")
