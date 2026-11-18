"""시나리오 S1을 실제 LLM으로 돌려 결과 카드를 확인한다 (조회 도구·계산은 tests/fakes.py의 가짜).

    cd backend && .venv/bin/python scripts/demo_analysis.py
"""

import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from agent.cost import CostTracker  # noqa: E402
from agent.llm import make_llm  # noqa: E402
from agent.loop import run_analysis  # noqa: E402
from tests.fakes import MAIN_SITE, SIMILAR, FakeCalc, FakeTools, site_b, store  # noqa: E402


def main() -> None:
    cost = CostTracker()
    llm = make_llm(cost)
    start = time.time()
    res = run_analysis(
        store(sites=[MAIN_SITE, site_b()]), tools=FakeTools(similar=SIMILAR), calc=FakeCalc(), llm=llm,
        emit=lambda e, d: print(f"[{e}] {json.dumps(d, ensure_ascii=False)}") if e != "item" else None,
    )
    print(f"\n== 결과 ({time.time() - start:.1f}초) 요약: {res.summary}")
    for it in res.items:
        print(f"\n[{it.item_id}] {it.verdict}/{it.decided_by}  {it.title}\n  이유: {it.reason}")
        if it.consequence:
            print(f"  안 하면: {it.consequence}")
        for o in it.options:
            rec = " ★추천" if it.recommendation and it.recommendation.option_id == o.option_id else ""
            print(f"  - {o.option_id} {o.label}{rec}: {o.summary} (기간 {o.time.text} / 비용 {o.cost.text})")
        if it.recommendation:
            print(f"  추천 이유: {it.recommendation.reason}")
        for p in it.prepared:
            print(f"  [초안:{p.kind}] {p.title}\n    {p.body}")
        if it.user_action:
            print(f"  할 일: {it.user_action.text} ({it.user_action.est_minutes}분)")
    print(f"\n가드레일 조정: {res.guardrail_changes}")
    print(f"토큰(입력, 출력): {cost.total_tokens}")


if __name__ == "__main__":
    main()
