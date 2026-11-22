from agent.analysis_cache import AnalysisResponseCache
from agent.ports import ToolResult
from rules.ai_applicability import RuleJudgment, _group_inputs
from rules.applicability import RuleOutcome


def test_cache_ttl_isolation_and_bounded_capacity():
    now = [0]
    cache = AnalysisResponseCache(capacity=2, ttl_seconds=5, clock=lambda: now[0])
    response = RuleJudgment(rule_id="R", status="applies", reason="확인", cited=["법 제7조"])
    cache.put(b"first", response)
    response.cited.clear()
    reused = cache.get(b"first")
    assert reused.cited == ["법 제7조"]
    reused.cited.clear()
    assert cache.get(b"first").cited == ["법 제7조"]
    cache.put(b"second", response)
    cache.put(b"third", response)
    assert cache.get(b"first") is None
    assert cache.get(b"second").cited == []
    now[0] = 5
    assert cache.get(b"second") is None


def test_law_group_shares_text_and_keeps_each_rules_original_sources():
    first = {"law_name": "식품위생법", "article": "제37조", "text": "영업을 하려는 자는 신고해야 한다."}
    second = {"law_name": "근로기준법", "article": "제17조", "text": "근로조건을 명시하여야 한다."}
    laws = {
        "permit_docs": ToolResult(ok=True, source="법령정보", data={"articles": [first]}),
        "labor_contract": ToolResult(ok=True, source="법령정보", data={"articles": [second]}),
    }
    rules = [RuleOutcome(rule_id=key, check_id=check, title=key, status="needs_check", reason="",
                         required_action=action)
             for key, check, action in [("REPORT", "permit_docs", "신고"), ("FACILITY", "permit_docs", "시설"),
                                        ("LABOR", "labor_contract", "근로조건")]]
    payload, evidence = _group_inputs(rules, laws)
    assert [[rule["rule_id"] for rule in group["rules"]] for group in payload] == [["REPORT", "FACILITY"], ["LABOR"]]
    assert [group["articles"] for group in payload] == [[{"key": "식품위생법 제37조", "text": first["text"]}],
                                                         [{"key": "근로기준법 제17조", "text": second["text"]}]]
    assert evidence == {"REPORT": {"식품위생법 제37조": first}, "FACILITY": {"식품위생법 제37조": first},
                        "LABOR": {"근로기준법 제17조": second}}
