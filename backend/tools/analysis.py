"""분석 도구 조립과 실제 조회 → 캐시 → 모의 응답 처리."""

from datetime import timedelta
import hashlib
import json
from pathlib import Path

from dotenv import load_dotenv

from sqlalchemy.dialects.postgresql import insert

from agent.llm import LLMError, make_llm
from agent.ports import ToolResult
from config import get_settings
from db.models import ApiCache
from db.session import transaction
from services.timeutil import now_utc

MOCK = Path(__file__).resolve().parents[1] / "mocks" / "demo" / "seoyeon_inputs.json"


class UnavailableLLM:
    def __init__(self, cost):
        self.cost = cost

    def parse(self, **kwargs):
        raise LLMError("AI 연결을 사용할 수 없어 기본 처리합니다.")


class AnalysisTools:
    def __init__(self, *, providers=None, use_mock=None):
        self.use_mock = get_settings().use_mock if use_mock is None else use_mock
        self.providers = providers
        self.mocks = json.loads(MOCK.read_text(encoding="utf-8"))["tools"]

    @staticmethod
    def _key(source, params):
        digest = hashlib.sha256(json.dumps(params, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        return f"{source}:{digest}"

    def _mock(self, source, check_id=None):
        raw = self.mocks.get(source)
        if source == "law":
            raw = (raw or {}).get(check_id)
        if not raw:
            return ToolResult(ok=False, source=source, error="사용 가능한 모의 응답 없음")
        return ToolResult.model_validate(raw).model_copy(update={"from_mock": True})

    def _cached(self, key, fresh=False):
        with transaction() as session:
            row = session.get(ApiCache, key)
            if row is None or (fresh and row.expires_at <= now_utc()):
                return None
            return ToolResult.model_validate(row.payload).model_copy(update={"from_cache": True})

    def _query(self, source, params, fetch, check_id=None):
        if self.use_mock:
            return self._mock(source, check_id)
        key = self._key(source, params)
        cached = self._cached(key, fresh=True)
        if cached is not None:
            return cached
        try:
            result = fetch()
        except Exception:
            result = ToolResult(ok=False, source=source, error="외부 조회 실패")
        if result.ok:
            # 모의·오래된 대체 결과를 새 실제 조회 결과로 캐시에 덮어쓰지 않는다.
            if not result.from_mock and not result.from_cache:
                now = now_utc()
                result = result.model_copy(update={"fetched_at": result.fetched_at or now})
                with transaction() as session:
                    stmt = insert(ApiCache).values(key=key, source=source, payload=result.model_dump(mode="json"),
                                                   fetched_at=result.fetched_at,
                                                   expires_at=now + timedelta(days=1 if source == "law" else 7))
                    session.execute(stmt.on_conflict_do_update(index_elements=[ApiCache.key], set_={
                        "payload": stmt.excluded.payload, "fetched_at": stmt.excluded.fetched_at,
                        "expires_at": stmt.excluded.expires_at}))
            return result
        cached = self._cached(key)
        return cached if cached is not None else self._mock(source, check_id)

    @staticmethod
    def _building_params(store):
        return {"address": store.address, "detail": store.address_detail, "codes": store.address_codes}

    def building(self, store):
        return self._query("building", self._building_params(store), lambda: self.providers.building(store))

    def cached_building(self, store):
        if self.use_mock:
            return self._mock("building")
        return self._cached(self._key("building", self._building_params(store))) or ToolResult(
            ok=False, source="건축물대장", error="부분 분석에 재사용할 건물 조회 결과 없음")

    def trademark(self, name):
        return self._query("trademark", {"name": name}, lambda: self.providers.trademark(name))

    def law(self, check_id):
        references = getattr(self.providers, "references", {}).get(check_id)
        return self._query("law", {"check_id": check_id, "references": references},
                           lambda: self.providers.law(check_id), check_id)

    def close(self):
        if self.providers is not None and hasattr(self.providers, "close"):
            self.providers.close()


def make_dependencies(cost):
    from tools.providers import Providers

    load_dotenv(MOCK.parents[2] / ".env", override=False)
    tools = AnalysisTools(providers=Providers())
    try:
        llm = make_llm(cost)
    except LLMError:
        llm = UnavailableLLM(cost)
    return tools, llm
