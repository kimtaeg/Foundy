from agent.guardrails import enforce
from agent.schemas import (
    Estimate, Evidence, Option, Recommendation, ReportItem,
)

EV = Evidence(type="data", source="건축물대장 층별개요", value="1층 제1종근린생활시설")


def item(**kw) -> ReportItem:
    base = dict(item_id="r-01", check_id="building_use", stage="계약 전", title="t",
                verdict="high", decided_by="rule", evidence=[EV])
    base.update(kw)
    return ReportItem(**base)


def test_no_evidence_forces_unknown():
    out, changes = enforce(item(evidence=[]))
    assert out.verdict == "unknown" and changes


def test_no_evidence_unknown_stays_without_change():
    out, changes = enforce(item(verdict="unknown", evidence=[]))
    assert out.verdict == "unknown" and not changes


def test_ai_cannot_be_high():
    out, _ = enforce(item(decided_by="ai"))
    assert out.verdict == "low"


def test_rule_high_with_evidence_kept():
    out, changes = enforce(item())
    assert out.verdict == "high" and not changes


def test_disallowed_remedy_options_removed_and_recommendation_dropped():
    opts = [Option(option_id="o-1", label="a", remedy="change_business_type"),
            Option(option_id="o-2", label="b", remedy="invented"),
            Option(option_id="o-3", label="c")]
    out, changes = enforce(item(options=opts, recommendation=Recommendation(option_id="o-2", reason="x")),
                           allowed_remedies=["change_business_type"])
    assert [o.option_id for o in out.options] == ["o-1"]
    assert out.recommendation is None and len(changes) == 2


def test_allowed_none_means_no_remedy_filter():
    opts = [Option(option_id="o-1", label="a")]
    out, _ = enforce(item(options=opts))
    assert len(out.options) == 1


def test_guidance_without_evidence_is_unknown():
    out, changes = enforce(item(check_id="labeling", evidence=[], verdict="ok"))
    assert out.verdict == "unknown" and changes


def test_estimate_without_basis_has_no_number():
    e = Estimate(text="약 3주", basis=None, delta_krw=4_000_000)
    assert e.text == "확인 필요" and e.delta_krw is None
    ok = Estimate(text="+400만원", basis="calc", delta_krw=4_000_000)
    assert ok.delta_krw == 4_000_000
