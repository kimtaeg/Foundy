"""AI 상담 질문 범위 판별 2단계 (키워드에 안 걸린 질문만): 저비용 모델이 창업 상담 범위인지 판별한다.

- 키워드(assistant.SCOPE_TERMS)에 맞는 질문은 여기까지 오지 않는다 (AI 호출 없음).
- 판별 결과는 {"allowed": bool, "reason": str} 구조화 출력으로만 받는다.
- 표현이 달라도 창업·가게 준비·운영과 관련되면 허용하고, 날씨·주식·코딩·일반 잡담처럼 서비스와 무관하면 막는다.
- 판별 호출이 실패하거나 시간 안에 끝나지 않으면 **허용한다**. 1차 키워드는 이미 통과하지 못했지만, 본 상담의
  시스템 프롬프트가 역할을 창업 상담으로 묶고 있어서, 판별 장애 때문에 정상 질문까지 막는 것보다 낫다.
- 호출마다 결과·토큰·걸린 시간과 프로세스 누적 호출 수·토큰을 `foundy.chat_scope` 로그 한 줄로 남긴다.
  토큰은 상담 비용 기록(CostTracker → cost_logs, step='chat_scope')에도 함께 쌓인다.
"""

from __future__ import annotations

import logging
import os
import sys
import threading
import time
from dataclasses import dataclass

from pydantic import BaseModel, Field

STEP = "chat_scope"
DEFAULT_MODEL = "gpt-4.1-mini"
TIMEOUT_SEC = 8.0
MAX_HISTORY = 4
MAX_CHARS = 500

logger = logging.getLogger("foundy.chat_scope")
if not logger.handlers:  # 앱 전체 로그 설정이 없어도 판별 기록은 표준 출력(Railway 로그)에 남긴다
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter("%(levelname)s %(name)s %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


class ScopeVerdict(BaseModel):
    allowed: bool = Field(description="카페·음식점 창업 상담 범위면 true")
    reason: str = Field(description="판별 이유 한 줄 (예: 창업 관련 질문)")


@dataclass
class ScopeDecision:
    allowed: bool
    reason: str
    source: str  # keyword | ai | ai_error


SYSTEM = """너는 카페·음식점 창업 준비 상담 서비스(FOUNDY)의 질문 분류기다.
사용자 질문이 이 서비스의 상담 범위인지 판별해 JSON 으로만 답한다: {"allowed": true|false, "reason": "한 줄 이유"}

상담 범위 (표현이 달라도 관련 있으면 allowed=true):
- 창업·개업 준비 전반: 오늘·이번 주 할 일, 일정, 마감·기한, 진행 상황, 놓친 것, 다음 단계, 체크리스트, 필요한 서류
- 인허가·영업신고·위생(보건증·위생교육)·소방·간판·원산지·메뉴·광고 문구·식품·주류
- 건물·주소·층·면적, 임대차(보증금·월세·권리금·관리비·계약), 상권·입지·유동인구·주변 가게
- 상호·상표, 직원 채용·근로계약·4대보험, 세무·사업자등록·부가세, 창업 자금·대출·지원사업·정책
- 이 가게의 정보·점검 결과, 이 서비스 사용법
- 인사·감사·짧은 맞장구, 앞의 상담 대화에 이어지는 후속 질문

범위 밖 (allowed=false): 날씨, 주식·코인·투자, 스포츠·연예, 일반 상식·퀴즈, 프로그래밍·코드 작성, 번역·작문 대행,
여행·맛집·쇼핑 추천, 건강·연애 등 개인 상담, 창업과 무관한 잡담.

애매하면 allowed=true 로 한다. reason 은 15자 안팎 한국어로 쓴다 (예: "창업 관련 질문", "날씨 질문")."""


class _Counter:
    """프로세스 안 누적 판별 호출 수·토큰 (로그로 확인용)."""

    def __init__(self):
        self._lock = threading.Lock()
        self.calls = self.errors = self.input_tokens = self.output_tokens = 0

    def add(self, input_tokens: int, output_tokens: int, error: bool) -> tuple[int, int, int, int]:
        with self._lock:
            self.calls += 1
            self.errors += int(error)
            self.input_tokens += input_tokens
            self.output_tokens += output_tokens
            return self.calls, self.errors, self.input_tokens, self.output_tokens


COUNTER = _Counter()


def scope_model() -> str:
    return (os.getenv("LLM_MODEL_SCOPE") or DEFAULT_MODEL).split("#")[0].strip() or DEFAULT_MODEL


def _user_text(question: str, history: list[dict] | None) -> str:
    recent = [r for r in (history or []) if isinstance(r, dict) and r.get("role") in ("user", "assistant")][-MAX_HISTORY:]
    lines = [f"{'사용자' if r['role'] == 'user' else '상담사'}: {str(r.get('content') or '')[:MAX_CHARS]}" for r in recent]
    context = "\n".join(lines) if lines else "(없음)"
    return f"[직전 대화]\n{context}\n\n[판별할 질문]\n{str(question)[:MAX_CHARS]}"


def _call(llm, model: str, user: str) -> tuple[ScopeVerdict, int, int]:
    """판별 호출 1번 (재시도 없음, TIMEOUT_SEC 안에 끝나야 한다). (결과, 입력 토큰, 출력 토큰)."""
    client = getattr(llm, "client", None)
    if client is None or not hasattr(client, "with_options"):
        raise RuntimeError("범위 판별은 OpenAI LLM 에서만 쓸 수 있어요")
    resp = client.with_options(timeout=TIMEOUT_SEC, max_retries=0).chat.completions.parse(
        model=model, temperature=0, max_tokens=60, response_format=ScopeVerdict,
        messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
    )
    usage = getattr(resp, "usage", None)
    tokens_in = getattr(usage, "prompt_tokens", 0) or 0
    tokens_out = getattr(usage, "completion_tokens", 0) or 0
    parsed = resp.choices[0].message.parsed
    if parsed is None:
        raise RuntimeError("구조화 출력 없음")
    return parsed, tokens_in, tokens_out


def classify(llm, question: str, history: list[dict] | None = None) -> ScopeDecision:
    """키워드에 안 걸린 질문을 저비용 모델로 판별한다. 실패·시간 초과는 허용(ai_error)."""
    model = scope_model()
    started = time.monotonic()
    tokens_in = tokens_out = 0
    try:
        verdict, tokens_in, tokens_out = _call(llm, model, _user_text(question, history))
        decision = ScopeDecision(bool(verdict.allowed), (verdict.reason or "").strip()[:60] or "-", "ai")
        error = None
    except Exception as exc:  # noqa: BLE001 - 타임아웃·네트워크·한도·형식 오류 모두 허용으로 넘긴다
        decision = ScopeDecision(True, "판별 실패로 허용", "ai_error")
        error = type(exc).__name__
    cost = getattr(llm, "cost", None)
    if cost is not None and (tokens_in or tokens_out):
        cost.record(STEP, model, tokens_in, tokens_out)
    calls, errors, total_in, total_out = COUNTER.add(tokens_in, tokens_out, error is not None)
    logger.info(
        "chat_scope_check result=%s source=%s reason=%s model=%s input_tokens=%d output_tokens=%d elapsed_ms=%d "
        "error=%s total_calls=%d total_errors=%d total_input_tokens=%d total_output_tokens=%d",
        "allowed" if decision.allowed else "blocked", decision.source, decision.reason, model, tokens_in, tokens_out,
        round((time.monotonic() - started) * 1000), error or "-", calls, errors, total_in, total_out,
    )
    return decision
