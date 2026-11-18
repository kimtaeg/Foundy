from datetime import date

from agent.grants import Condition, GrantExtraction, grant_checklist_items, judge_grants
from agent.llm import FakeLLM, LLMError
from agent.ports import ToolResult

from .fakes import FakeCalc, store

TODAY = date(2026, 11, 20)
NOTICE = "신청 대상: 만 39세 이하의 예비창업자 또는 창업 3년 이내 기업. 서울 소재 사업장. 제출 서류: 사업계획서"
S = store(owner_birth_year=1998)


def grant(gid="g1", text=NOTICE, deadline="2027-01-31", **kw):
    return {"grant_id": gid, "title": f"공고 {gid}", "source": "K-Startup", "url": "https://k/1",
            "deadline": deadline, "text": text, **kw}


def res(*grants) -> ToolResult:
    return ToolResult(ok=True, source="K-Startup", data={"grants": list(grants)})


def cond(kind, text, quote, **kw) -> Condition:
    return Condition(kind=kind, text=text, quote=quote, **kw)


def ex(*conds, **kw) -> GrantExtraction:
    return GrantExtraction(conditions=list(conds), who="청년 창업자", how_much="최대 1천만 원", **kw)


AGE = cond("age_max", "만 39세 이하", "만 39세 이하의 예비창업자", number=39)
YEARS = cond("business_years_max", "창업 3년 이내", "창업 3년 이내 기업", number=3)
REGION = cond("region", "서울 소재", "서울 소재 사업장", regions=["서울"])


def run(extraction, g=None, today=TODAY, st=S):
    return judge_grants(FakeLLM({"grants_extract": extraction}), st, res(g or grant()), today)


def test_all_conditions_pass_is_eligible_with_notice_evidence():
    r = run(ex(AGE, YEARS, REGION, what_to_submit=["사업계획서"]))
    m = r.items[0]
    assert m.eligibility.result == "eligible" and m.eligibility.decided_by == "ai"
    assert [c.result for c in m.eligibility.checks] == ["pass", "pass", "pass"]
    assert m.eligibility.checks[0].evidence.type == "notice"
    assert m.eligibility.checks[0].evidence.text == "만 39세 이하의 예비창업자"
    assert m.summary.what_to_submit == ["사업계획서"] and m.summary.until == "2027-01-31" and m.summary.by == "ai"


def test_unknown_condition_makes_partial():
    other = cond("other", "음식점업 가능", "서울 소재 사업장", ai_result="unknown")
    assert run(ex(AGE, other)).items[0].eligibility.result == "partial"


def test_boundary_age_is_unknown_not_fail():
    st = store(owner_birth_year=1998)
    border = cond("age_max", "만 27세 이하", "만 39세 이하의 예비창업자", number=27)  # 숫자가 인용에 없음 → unknown
    m = run(ex(border), st=st).items[0]
    assert m.eligibility.result == "unknown" and "숫자" in m.eligibility.checks[0].note
    ok_quote = cond("age_max", "만 27세 이하", "만 27세 이하의 예비창업자", number=27)
    g = grant(text="만 27세 이하의 예비창업자")
    m = run(ex(ok_quote), g=g, st=st).items[0]
    assert m.eligibility.checks[0].result == "unknown" and "생일" in m.eligibility.checks[0].note


def test_clear_mismatch_excludes_grant():
    old = store(owner_birth_year=1980)
    r = run(ex(AGE, YEARS), st=old)
    assert r.items == [] and r.excluded_count == 1
    busan = cond("region", "부산 소재", "부산 소재 사업장", regions=["부산"])
    r = run(ex(busan), g=grant(text="부산 소재 사업장"))
    assert r.items == [] and r.excluded_count == 1


def test_ai_other_condition_fail_excludes():
    other = cond("other", "제조업만", "서울 소재 사업장", ai_result="fail")
    assert run(ex(other)).excluded_count == 1


def test_invented_quote_is_unknown_never_pass():
    fake = cond("age_max", "만 39세 이하", "만 45세 이하만 신청 가능", number=45)
    m = run(ex(fake)).items[0]
    c = m.eligibility.checks[0]
    assert c.result == "unknown" and c.evidence is None and m.eligibility.result == "unknown"


def test_quote_matching_ignores_whitespace():
    spaced = cond("age_max", "만 39세 이하", "만  39세\n이하의 예비창업자", number=39)
    assert run(ex(spaced)).items[0].eligibility.checks[0].result == "pass"


def test_preliminary_founder_with_number_zero():
    pre = cond("business_years_max", "예비창업자", "예비창업자", number=0)
    assert run(ex(pre), g=grant(text="예비창업자 대상")).items[0].eligibility.result == "eligible"
    opened = store(owner_birth_year=1998, opening_date=date(2025, 1, 1))
    assert run(ex(pre), g=grant(text="예비창업자 대상"), st=opened).excluded_count == 1


def test_no_conditions_is_unknown():
    assert run(ex()).items[0].eligibility.result == "unknown"


def test_closed_grants_skipped_and_counted():
    r = run(ex(AGE), g=grant(deadline="2026-11-01"))
    assert r.items == [] and r.closed_count == 1


def test_sorted_by_eligibility_then_deadline():
    llm = FakeLLM({"grants_extract": ex(AGE)})
    unknown_g = grant("g2", text="아무 조건 없음", deadline="2026-12-01")  # 인용을 확인 못 해 unknown
    r = judge_grants(llm, S, res(unknown_g, grant("g1", deadline="2027-02-01"), grant("g3", deadline="2027-01-01")), TODAY)
    assert [m.grant_id for m in r.items] == ["g3", "g1", "g2"]


def test_llm_failure_keeps_grant_as_unknown():
    r = judge_grants(FakeLLM({"grants_extract": LLMError("x")}), S, res(grant()), TODAY)
    m = r.items[0]
    assert m.eligibility.result == "unknown" and m.summary.who == "[확인 필요]" and m.summary.until == "2027-01-31"


def test_tool_failure():
    r = judge_grants(FakeLLM({}), S, ToolResult(ok=False, source="K-Startup"), TODAY)
    assert r.ok is False and r.items == []


def test_deadline_goes_to_checklist_only_for_possible_grants():
    llm = FakeLLM({"grants_extract": ex(AGE)})
    r = judge_grants(llm, S, res(grant("g1"), grant("g2", text="조건 없음")), TODAY)
    items = grant_checklist_items(r, FakeCalc(), S.opening_date, 8, TODAY)
    assert len(items) == 1 and items[0].item_id == "c-08" and items[0].category == "정책"
    assert items[0].source == "grant" and str(items[0].due_date) == "2027-01-31"
    assert items[0].dday == -30 and items[0].documents == []
    assert [m.added_to_checklist for m in r.items] == [True, False]
