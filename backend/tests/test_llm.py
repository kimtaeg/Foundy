from types import SimpleNamespace

import pytest

from agent.cost import CostTracker
from agent.llm import LLMError, OpenAILLM, model_for
from agent.schemas import Question


def _resp(parsed, pt=100, ct=20):
    msg = SimpleNamespace(parsed=parsed, refusal=None)
    return SimpleNamespace(choices=[SimpleNamespace(message=msg)],
                           usage=SimpleNamespace(prompt_tokens=pt, completion_tokens=ct))


class FakeClient:
    def __init__(self, results):
        self.results, self.calls = list(results), 0
        self.chat = SimpleNamespace(completions=SimpleNamespace(parse=self._parse))

    def _parse(self, **kw):
        self.calls += 1
        r = self.results.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


Q = Question(id="a", text="t", type="boolean", why="w")


def test_parse_records_cost(monkeypatch):
    monkeypatch.setenv("LLM_MODEL_FAST", "m-fast")
    monkeypatch.setenv("LLM_PRICE_IN_USD_PER_1M", "1000000")  # 토큰당 1달러
    monkeypatch.setenv("LLM_PRICE_OUT_USD_PER_1M", "0")
    monkeypatch.setenv("USD_KRW", "1000")
    cost = CostTracker()
    llm = OpenAILLM(cost=cost, client=FakeClient([_resp(Q)]))
    assert llm.parse(step="ask", tier="fast", system="s", user="u", schema=Question) == Q
    assert cost.total_krw == 100 * 1000 and cost.total_tokens == (100, 20)


def test_retries_once_then_succeeds(monkeypatch):
    monkeypatch.setenv("LLM_MODEL_MAIN", "m")
    client = FakeClient([TimeoutError("t"), _resp(Q)])
    assert OpenAILLM(client=client).parse(step="s", tier="main", system="", user="", schema=Question) == Q
    assert client.calls == 2


def test_fails_after_two_attempts(monkeypatch):
    monkeypatch.setenv("LLM_MODEL_MAIN", "m")
    client = FakeClient([TimeoutError("a"), TimeoutError("b")])
    with pytest.raises(LLMError):
        OpenAILLM(client=client).parse(step="s", tier="main", system="", user="", schema=Question)
    assert client.calls == 2


def test_refusal_is_error(monkeypatch):
    monkeypatch.setenv("LLM_MODEL_MAIN", "m")
    with pytest.raises(LLMError):
        OpenAILLM(client=FakeClient([_resp(None), _resp(None)])).parse(
            step="s", tier="main", system="", user="", schema=Question)


def test_missing_model_env(monkeypatch):
    monkeypatch.delenv("LLM_MODEL_FAST", raising=False)
    with pytest.raises(LLMError):
        model_for("fast")


# ---- Gemini 어댑터 ----
from agent.llm import GeminiLLM, make_llm


class FakeGenaiClient:
    def __init__(self, results):
        self.results, self.calls, self.configs = list(results), 0, []
        self.models = SimpleNamespace(generate_content=self._gen)

    def _gen(self, *, model, contents, config):
        self.calls += 1
        self.configs.append((model, contents, config))
        r = self.results.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def _gresp(parsed=None, text="", pt=100, ct=20, tt=30):
    usage = SimpleNamespace(prompt_token_count=pt, candidates_token_count=ct, thoughts_token_count=tt)
    return SimpleNamespace(parsed=parsed, text=text, usage_metadata=usage)


def test_gemini_parse_records_cost_including_thinking(monkeypatch):
    monkeypatch.setenv("LLM_MODEL_MAIN", "g-main")
    monkeypatch.setenv("LLM_PRICE_IN_USD_PER_1M", "0")
    monkeypatch.setenv("LLM_PRICE_OUT_USD_PER_1M", "1000000")
    monkeypatch.setenv("USD_KRW", "1000")
    cost = CostTracker()
    client = FakeGenaiClient([_gresp(parsed=Q)])
    out = GeminiLLM(cost=cost, client=client).parse(step="s", tier="main", system="sys", user="usr", schema=Question)
    assert out == Q
    assert cost.total_tokens == (100, 50)  # 출력 = 후보 20 + 생각 30
    assert cost.total_krw == 50 * 1000
    model, contents, config = client.configs[0]
    assert model == "g-main" and contents == "usr"
    assert config.system_instruction == "sys" and config.response_mime_type == "application/json"


def test_gemini_falls_back_to_text_json(monkeypatch):
    monkeypatch.setenv("LLM_MODEL_FAST", "g")
    client = FakeGenaiClient([_gresp(parsed=None, text=Q.model_dump_json())])
    assert GeminiLLM(client=client).parse(step="s", tier="fast", system="", user="", schema=Question) == Q


def test_gemini_retries_on_429_then_succeeds(monkeypatch):
    monkeypatch.setenv("LLM_MODEL_FAST", "g")
    client = FakeGenaiClient([RuntimeError("429 RESOURCE_EXHAUSTED"), _gresp(parsed=Q)])
    assert GeminiLLM(client=client).parse(step="s", tier="fast", system="", user="", schema=Question) == Q
    assert client.calls == 2


def test_gemini_fails_after_two_attempts(monkeypatch):
    monkeypatch.setenv("LLM_MODEL_FAST", "g")
    client = FakeGenaiClient([RuntimeError("a"), _gresp(parsed=None, text="not json")])
    with pytest.raises(LLMError):
        GeminiLLM(client=client).parse(step="s", tier="fast", system="", user="", schema=Question)
    assert client.calls == 2


def test_make_llm_selects_provider(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    assert isinstance(make_llm(), GeminiLLM)  # 기본값
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    assert isinstance(make_llm(), OpenAILLM)
    monkeypatch.setenv("LLM_PROVIDER", "nope")
    with pytest.raises(LLMError):
        make_llm()


def test_missing_api_key(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    with pytest.raises(LLMError):
        GeminiLLM()


def test_gemini_thinking_level_from_env(monkeypatch):
    monkeypatch.setenv("LLM_MODEL_FAST", "g")
    monkeypatch.setenv("LLM_THINKING_LEVEL", "minimal")
    client = FakeGenaiClient([_gresp(parsed=Q)])
    GeminiLLM(client=client).parse(step="s", tier="fast", system="", user="", schema=Question)
    assert str(client.configs[0][2].thinking_config.thinking_level).endswith("MINIMAL")
    monkeypatch.delenv("LLM_THINKING_LEVEL")
    client = FakeGenaiClient([_gresp(parsed=Q)])
    GeminiLLM(client=client).parse(step="s", tier="fast", system="", user="", schema=Question)
    assert client.configs[0][2].thinking_config is None
