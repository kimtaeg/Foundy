"""LLM 호출별 토큰·비용 기록 (cost_logs 테이블, SSE done 이벤트의 cost_krw에 쓴다).

단가는 모델이 바뀌면 달라지므로 코드에 박지 않고 환경변수로 받는다.
  LLM_PRICE_IN_USD_PER_1M, LLM_PRICE_OUT_USD_PER_1M  (모델별 단가, 없으면 0)
  USD_KRW  (환율 근삿값, 기본 1400)
단가가 0이면 cost_krw도 0이 된다. 점검 1회 비용 실측 전에 실제 단가를 넣는다.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class CostRow:
    step: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_krw: float


@dataclass
class CostTracker:
    rows: list[CostRow] = field(default_factory=list)

    def record(self, step: str, model: str, input_tokens: int, output_tokens: int) -> CostRow:
        price_in = float(os.getenv("LLM_PRICE_IN_USD_PER_1M") or "0")
        price_out = float(os.getenv("LLM_PRICE_OUT_USD_PER_1M") or "0")
        usd_krw = float(os.getenv("USD_KRW") or "1400")
        usd = (input_tokens * price_in + output_tokens * price_out) / 1_000_000
        row = CostRow(step, model, input_tokens, output_tokens, round(usd * usd_krw, 2))
        self.rows.append(row)
        return row

    @property
    def total_krw(self) -> float:
        return round(sum(r.cost_krw for r in self.rows), 2)

    @property
    def total_tokens(self) -> tuple[int, int]:
        return sum(r.input_tokens for r in self.rows), sum(r.output_tokens for r in self.rows)
