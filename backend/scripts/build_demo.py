"""예시로 해보기(이서연 씨 사례)의 저장 결과를 만든다.

입력(mocks/demo/seoyeon_inputs.json)으로 실제 LLM을 호출해 분석을 한 번 돌리고,
되묻기 질문·진행 이벤트(재생용)·리포트 항목·체크리스트를 mocks/demo/seoyeon.json에 저장한다.
백엔드 POST /api/demo는 이 파일을 복사해 새 store_id로 만들면 된다 (외부 API·LLM이 모두 실패해도 동작).

    cd backend && .venv/bin/python scripts/build_demo.py
결과 문장은 LLM이 쓰므로 실행할 때마다 조금 달라진다. 만든 뒤 눈으로 확인하고 커밋한다.
"""

import json
import os
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from agent.cost import CostTracker  # noqa: E402
from agent.llm import make_llm  # noqa: E402
from agent.loop import run_analysis  # noqa: E402
from agent.ports import StoreInput  # noqa: E402
from agent.questions import select_questions  # noqa: E402
from rules.engine import load_pack  # noqa: E402
from tests.fakes import FakeCalc, JsonTools  # noqa: E402

DEMO = ROOT / "mocks" / "demo"
# 이서연 씨 사례가 보여줘야 하는 판정. LLM이 일시적으로 실패해 unknown이 되면 다시 돌린다.
EXPECTED = {"building_use": "high", "building_violation": "unknown", "alcohol_vs_type": "ok",
            "trademark_similar": "low"}


def main() -> None:
    inputs = json.loads((DEMO / "seoyeon_inputs.json").read_text(encoding="utf-8"))
    pack = load_pack("cafe_restaurant")
    cost = CostTracker()
    llm = make_llm(cost)
    store = StoreInput(**inputs["store"])

    # 가게 등록 직후 화면에 나오는 되묻기 질문 (답이 비어 있는 상태 기준)
    questions = select_questions(llm, pack, store.model_copy(update={"answers": {}}))

    # 문제 항목마다 결과 카드가 모두 채워질 때까지 다시 돌린다 (LLM 일시 장애로 빈 카드가 저장되는 걸 막는다)
    for attempt in range(1, 4):
        events: list[dict] = []
        res = run_analysis(
            store, tools=JsonTools(inputs["tools"]), calc=FakeCalc(), llm=llm, pack=pack,
            emit=lambda event, data: events.append({"event": event, "data": data}),
        )
        incomplete = [i.check_id for i in res.items
                      if i.verdict != "ok" and not (i.consequence and i.user_action)]
        incomplete += [f"{i.check_id}(추천 없음)" for i in res.items if i.options and not i.recommendation]
        incomplete += [f"{i.check_id}(기대 {EXPECTED[i.check_id]}, 실제 {i.verdict})" for i in res.items
                       if EXPECTED.get(i.check_id, i.verdict) != i.verdict]
        if not incomplete:
            break
        print(f"시도 {attempt}: 결과 카드가 비었거나 기대와 다른 항목 {incomplete} → 다시 시도")
    else:
        sys.exit(f"결과 카드를 모두 채우지 못했어요: {incomplete}")
    out = {
        "is_demo": True,
        "is_example": True,
        "example_notice": "예시 데이터입니다. 실제 조회 결과가 아닙니다.",
        "generated_at": date.today().isoformat(),
        "generated_with": {"provider": os.getenv("LLM_PROVIDER", "gemini"),
                           "fast": os.getenv("LLM_MODEL_FAST"), "main": os.getenv("LLM_MODEL_MAIN")},
        "store": store.model_dump(mode="json"),
        "questions": [q.model_dump(mode="json") for q in questions],
        "business_type": res.business_type,
        "events": events,
        "summary": res.summary,
        "report_items": [i.model_dump(mode="json") for i in res.items],
        "checklist": [c.model_dump(mode="json") for c in res.checklist],
        "guardrail_changes": res.guardrail_changes,
    }
    path = DEMO / "seoyeon.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"저장: {path}  요약 {res.summary}  토큰 {cost.total_tokens}  가드레일 조정 {res.guardrail_changes}")


if __name__ == "__main__":
    main()
