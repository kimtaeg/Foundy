"""LLM 연결 확인용 스모크 테스트. 실제로 호출하므로 키와 모델명이 .env에 있어야 한다.

    cd backend && .venv/bin/python scripts/llm_smoke.py
"""

import sys
import time
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from agent.cost import CostTracker  # noqa: E402
from agent.llm import make_llm, model_for  # noqa: E402
from agent.schemas import Question  # noqa: E402

SYSTEM = "너는 카페 창업 점검 도우미다. 주어진 상황에서 사용자에게 물어볼 질문 하나를 만든다."
USER = "사용자가 성수동 1층 카페를 열려고 한다. 술 판매 여부를 아직 모른다. 되물을 질문을 만들어라."


def main() -> None:
    cost = CostTracker()
    llm = make_llm(cost)
    for tier in ("fast", "main"):
        start = time.time()
        q = llm.parse(step=f"smoke_{tier}", tier=tier, system=SYSTEM, user=USER, schema=Question)
        print(f"[{tier}] {model_for(tier)}  {time.time() - start:.1f}초")
        print(f"  {q.model_dump_json(ensure_ascii=False)}")
    print(f"토큰(입력, 출력): {cost.total_tokens}, 비용: {cost.total_krw}원")


if __name__ == "__main__":
    main()
