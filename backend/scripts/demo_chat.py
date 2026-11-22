"""저장된 예시 데이터(mocks/demo/seoyeon.json)를 근거로 챗봇을 실제 LLM으로 시험해 본다.

    cd backend && .venv/bin/python scripts/demo_chat.py
"""

import json
import sys
import time
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from agent.chat import ChatContext, chat  # noqa: E402
from agent.llm import make_llm  # noqa: E402
from agent.ports import StoreInput  # noqa: E402
from agent.schemas import ChecklistItem, ReportItem  # noqa: E402

QUESTIONS = [
    ("술을 팔려면 어떻게 해야 해요?", {"type": "report_item", "id": "r-01"}),
    ("위반건축물이면 아예 못 여는 건가요?", {"type": "report_item", "id": "r-02"}),
    ("개업일을 4월 1일로 미루고 싶어요", None),
    ("부가세는 얼마나 내야 해요?", None),
    ("그럼 B 자리로 할게요", None),
]


def main() -> None:
    demo = json.loads((ROOT / "mocks" / "demo" / "seoyeon.json").read_text(encoding="utf-8"))
    ctx = ChatContext(store=StoreInput(**demo["store"]), report_items=[ReportItem(**i) for i in demo["report_items"]],
                      checklist=[ChecklistItem(**c) for c in demo["checklist"]], today=date(2026, 11, 20))
    llm = make_llm()
    history: list[dict] = []
    for q, focus in QUESTIONS:
        start = time.time()
        r = chat(llm, ctx, q, history=history, focus=focus)
        print(f"\nQ. {q}   ({time.time() - start:.1f}초)\nA. {r.answer}")
        for e in r.evidence:
            print(f"   근거: {e.source} {e.law_name or ''} {e.article or ''} {e.value or ''}")
        for a in r.actions:
            print(f"   제안: [{a.type}] {a.label} {json.dumps(a.payload, ensure_ascii=False)} (확인 필요: {a.requires_confirm})")
        history += [{"role": "user", "content": q}, {"role": "assistant", "content": r.answer}]


if __name__ == "__main__":
    main()
