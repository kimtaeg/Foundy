"""데모 시나리오 S1~S4 (docs/mvp.md 5장. S3 메뉴 광고 문구는 마지막에 구현이라 지금은 카드가 없다). 입력·기대 결과는 같은 폴더의 JSON에 고정되어 있다.

기본 실행은 LLM 응답을 JSON에 적힌 값으로 대체한다 (결정적).
실제 LLM으로 확인하려면 RUN_LLM_TESTS=1 pytest tests/scenarios -m llm  (키·모델이 .env에 있어야 한다).
"""

import json
import os
from pathlib import Path

import pytest

from agent.ports import StoreInput
from agent.loop import run_analysis
from rules.engine import load_pack

from ..fakes import FakeCalc, FakeTools, scenario_llm

DIR = Path(__file__).parent
FILES = sorted(DIR.glob("s*.json"))
PACK = load_pack("cafe_restaurant")


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def analyze(sc: dict, llm):
    return run_analysis(StoreInput(**sc["store"]), tools=FakeTools(**sc["tools"]), calc=FakeCalc(), llm=llm, pack=PACK)


def check(sc: dict, res) -> None:
    exp = sc["expect"]
    by = {i.check_id: i for i in res.items}
    assert res.business_type == exp["business_type"]
    for cid in exp.get("absent", []):
        assert cid not in by, f"{cid}는 나오면 안 돼요"
    for cid, e in exp["items"].items():
        item = by[cid]
        assert item.verdict == e["verdict"], cid
        if "decided_by" in e:
            assert item.decided_by == e["decided_by"], cid
        if "remedies" in e:
            assert [o.remedy for o in item.options] == e["remedies"], cid
        if "user_action" in e:
            assert item.user_action and item.user_action.type == e["user_action"], cid
        if "contact" in e:
            assert item.contact and item.contact.agency == e["contact"], cid
        if "evidence_contains" in e:
            assert any(e["evidence_contains"] in (ev.value or "") for ev in item.evidence), cid
        if item.verdict != "ok":
            assert item.evidence or item.verdict == "unknown", f"{cid}: 근거 없는 판정"
    if exp.get("no_cards"):
        assert all(not i.options for i in res.items)  # 선택지가 있는 결과 카드가 없다
    for task_id, cid in exp.get("checklist_linked", {}).items():
        linked = next(c for c in res.checklist if c.item_id == task_id)
        assert by[cid].item_id in linked.report_item_ids
    assert len(res.checklist) >= exp.get("checklist_min", 6)
    assert res.guardrail_changes == []  # 가드레일이 고칠 일이 없어야 한다


def ids(f: Path) -> str:
    return f.stem


@pytest.mark.parametrize("path", FILES, ids=ids)
def test_scenario(path):
    sc = load(path)
    res = analyze(sc, scenario_llm(sc["llm"]))
    assert res.summary == sc["expect"]["summary"]
    check(sc, res)


def test_all_mvp_scenarios_present():
    assert [load(f)["mvp"] for f in FILES] == ["S1", "S2", "S3", "S4"]


@pytest.mark.llm
@pytest.mark.skipif(os.getenv("RUN_LLM_TESTS") != "1", reason="실제 LLM 호출 (RUN_LLM_TESTS=1)")
@pytest.mark.parametrize("path", FILES, ids=ids)
def test_scenario_with_real_llm(path):
    """규칙으로 정해지는 판정은 그대로, AI 판정은 기대 방향이 맞는지 본다 (문장은 비교하지 않는다)."""
    from dotenv import load_dotenv

    from agent.llm import make_llm

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    sc = load(path)
    res = analyze(sc, make_llm())
    check({**sc, "expect": {**sc["expect"], "items": {
        k: {kk: vv for kk, vv in v.items() if kk not in ("remedies", "user_action", "contact")}
        for k, v in sc["expect"]["items"].items()}}}, res)
