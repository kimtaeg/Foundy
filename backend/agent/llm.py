"""LLM 호출 어댑터 (Gemini, OpenAI). 나머지 agent 코드는 LLM 프로토콜만 보므로 제공자를 바꾸기 쉽다.

- 제공자는 환경변수 LLM_PROVIDER (gemini | openai, 기본 gemini)로 고르고 make_llm()이 만든다.
- tier "fast": 되묻기·요약 (LLM_MODEL_FAST), "main": 판정·선택지·챗봇 (LLM_MODEL_MAIN)
- 구조화 출력(pydantic 스키마)으로만 받는다. 타임아웃 30초, 실패하면 1회 재시도.
- Gemini의 구조화 출력은 자유 형식 dict 필드를 지원하지 않는다. LLM에 넘기는 스키마에는 dict를 쓰지 않는다.
"""

from __future__ import annotations

import os
import time
from typing import Literal, Protocol, TypeVar

from pydantic import BaseModel

from .cost import CostTracker

T = TypeVar("T", bound=BaseModel)
Tier = Literal["fast", "main"]

TIMEOUT_SEC = 30
MAX_ATTEMPTS = 2
RETRY_DELAY_SEC = 2.0  # 무료 티어의 분당 한도(429)를 넘겼을 때 잠깐 쉬고 다시 시도한다


class LLMError(RuntimeError):
    pass


class LLM(Protocol):
    def parse(self, *, step: str, tier: Tier, system: str, user: str, schema: type[T]) -> T: ...


def model_for(tier: Tier) -> str:
    key = "LLM_MODEL_FAST" if tier == "fast" else "LLM_MODEL_MAIN"
    model = os.getenv(key)
    if not model:
        raise LLMError(f"환경변수 {key}가 비어 있습니다.")
    return model


class OpenAILLM:
    def __init__(self, cost: CostTracker | None = None, client=None):
        self.cost = cost or CostTracker()
        if client is None:
            from openai import OpenAI

            api_key = os.getenv("LLM_API_KEY")
            if not api_key:
                raise LLMError("환경변수 LLM_API_KEY가 비어 있습니다.")
            client = OpenAI(api_key=api_key, timeout=TIMEOUT_SEC)
        self.client = client

    def parse(self, *, step: str, tier: Tier, system: str, user: str, schema: type[T]) -> T:
        model = model_for(tier)
        last: Exception | None = None
        for attempt in range(MAX_ATTEMPTS):
            if attempt:
                time.sleep(RETRY_DELAY_SEC)
            try:
                resp = self.client.chat.completions.parse(
                    model=model,
                    messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                    response_format=schema,
                )
            except Exception as e:  # 네트워크·한도·타임아웃 모두 재시도 대상
                last = e
                continue
            usage = getattr(resp, "usage", None)
            if usage is not None:
                self.cost.record(step, model, usage.prompt_tokens, usage.completion_tokens)
            message = resp.choices[0].message
            if message.parsed is None:
                last = LLMError(f"구조화 출력 실패: {getattr(message, 'refusal', None) or '응답 없음'}")
                continue
            return message.parsed
        raise LLMError(f"LLM 호출 실패 (step={step}): {last}") from last


    def stream_tools(self, *, step: str, tier: Tier, messages: list[dict], tools: list[dict], require_tool: bool = False):
        """도구 호출을 허용한 대화 응답을 스트리밍한다 (AI 상담용).

        ("delta", 글자) 를 차례로 내보내고, 마지막에 ("final", {"content": 전체 글, "tool_calls": [...]}) 를 낸다.
        tool_calls 는 OpenAI 메시지 형식 [{"id", "type": "function", "function": {"name", "arguments"}}] 이다.
        """
        model = model_for(tier)
        try:
            extra = {"tools": tools, "tool_choice": "required" if require_tool else "auto"} if tools else {}
            stream = self.client.chat.completions.create(
                model=model, messages=messages, stream=True, stream_options={"include_usage": True}, **extra)
        except Exception as e:  # noqa: BLE001
            raise LLMError(f"LLM 호출 실패 (step={step}): {e}") from e
        content: list[str] = []
        calls: dict[int, dict] = {}
        try:
            for chunk in stream:
                usage = getattr(chunk, "usage", None)
                if usage is not None:
                    self.cost.record(step, model, usage.prompt_tokens, usage.completion_tokens)
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta.content:
                    content.append(delta.content)
                    yield "delta", delta.content
                for tc in delta.tool_calls or []:
                    slot = calls.setdefault(tc.index, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                    if tc.id:
                        slot["id"] = tc.id
                    if tc.function and tc.function.name:
                        slot["function"]["name"] += tc.function.name
                    if tc.function and tc.function.arguments:
                        slot["function"]["arguments"] += tc.function.arguments
        except Exception as e:  # noqa: BLE001
            raise LLMError(f"LLM 응답 중단 (step={step}): {e}") from e
        yield "final", {"content": "".join(content), "tool_calls": [calls[i] for i in sorted(calls)]}


class GeminiLLM:
    """Google Gemini API (google-genai). 무료 티어는 입력이 Google 제품 개선에 쓰일 수 있다."""

    def __init__(self, cost: CostTracker | None = None, client=None):
        self.cost = cost or CostTracker()
        if client is None:
            from google import genai

            api_key = os.getenv("LLM_API_KEY")
            if not api_key:
                raise LLMError("환경변수 LLM_API_KEY가 비어 있습니다.")
            client = genai.Client(api_key=api_key)
        self.client = client

    def parse(self, *, step: str, tier: Tier, system: str, user: str, schema: type[T]) -> T:
        from google.genai import types

        model = model_for(tier)
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            http_options=types.HttpOptions(timeout=TIMEOUT_SEC * 1000),
        )
        # 생각 깊이. 낮출수록 빠르고 토큰이 적다 (LLM_THINKING_LEVEL=minimal|low|medium|high, 비우면 모델 기본값)
        level = os.getenv("LLM_THINKING_LEVEL", "").strip().upper()
        if level:
            config.thinking_config = types.ThinkingConfig(thinking_level=level)
        last: Exception | None = None
        for attempt in range(MAX_ATTEMPTS):
            if attempt:
                time.sleep(RETRY_DELAY_SEC)
            try:
                resp = self.client.models.generate_content(model=model, contents=user, config=config)
            except Exception as e:  # 네트워크·한도(429)·타임아웃 모두 재시도 대상
                last = e
                continue
            usage = getattr(resp, "usage_metadata", None)
            if usage is not None:
                # 생각(thinking) 토큰도 출력 단가로 과금되므로 출력에 합산한다
                out = (usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0)
                self.cost.record(step, model, usage.prompt_token_count or 0, out)
            parsed = resp.parsed
            if not isinstance(parsed, schema):
                try:
                    parsed = schema.model_validate_json(resp.text or "")
                except Exception as e:
                    last = LLMError(f"구조화 출력 실패: {e}")
                    continue
            return parsed
        raise LLMError(f"LLM 호출 실패 (step={step}): {last}") from last


class GuardedLLM:
    """분석 1회 안에서 LLM이 계속 실패하면 남은 호출을 건너뛰는 보호막 (시연 중 먹통 방지).

    - 연속으로 max_failures번 실패하면 이후 호출은 기다리지 않고 바로 LLMError를 낸다 (한도 초과·서비스 장애 때 수 분씩 기다리지 않게).
    - 첫 호출부터 time_budget_sec가 지나도 같다.
    - LLMError를 받은 쪽은 이미 'AI 없이' 처리하도록 되어 있어서, 결과는 줄어들지만 분석은 끝난다.
    """

    def __init__(self, inner, max_failures: int = 3, time_budget_sec: float = 150.0, clock=time.monotonic):
        self.inner, self.max_failures, self.time_budget_sec, self.clock = inner, max_failures, time_budget_sec, clock
        self.consecutive = 0
        self.failures = 0  # 누적 실패 수 (화면에 'AI 없이 처리' 표시용)
        self.started: float | None = None

    @property
    def cost(self):
        return getattr(self.inner, "cost", None)

    @property
    def tripped(self) -> bool:
        return self.consecutive >= self.max_failures or (
            self.started is not None and self.clock() - self.started > self.time_budget_sec)

    def parse(self, *, step: str, tier: Tier, system: str, user: str, schema: type[T]) -> T:
        if self.started is None:
            self.started = self.clock()
        if self.tripped:
            self.failures += 1
            raise LLMError(f"LLM 호출 중단 (step={step}): 연속 실패 또는 시간 초과")
        try:
            out = self.inner.parse(step=step, tier=tier, system=system, user=user, schema=schema)
        except LLMError:
            self.consecutive += 1
            self.failures += 1
            raise
        self.consecutive = 0
        return out


def make_llm(cost: CostTracker | None = None) -> LLM:
    """LLM_PROVIDER 환경변수로 제공자를 고른다 (기본 gemini)."""
    provider = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    if provider == "gemini":
        return GeminiLLM(cost=cost)
    if provider == "openai":
        return OpenAILLM(cost=cost)
    raise LLMError(f"지원하지 않는 LLM_PROVIDER: {provider} (gemini | openai)")


class FakeLLM:
    """테스트용. step별로 미리 정한 응답(또는 호출 함수)을 돌려준다."""

    def __init__(self, responses: dict[str, BaseModel | Exception]):
        self.responses = responses
        self.calls: list[dict] = []

    def parse(self, *, step: str, tier: Tier, system: str, user: str, schema: type[T]) -> T:
        self.calls.append({"step": step, "tier": tier, "system": system, "user": user})
        r = self.responses[step]
        if isinstance(r, Exception):
            raise r
        if callable(r):  # 프롬프트(user)를 보고 응답을 만드는 테스트용 함수
            r = r(user)
        return r  # type: ignore[return-value]
