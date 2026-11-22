"""분석 도구 조립과 실제 조회 → 캐시 → 모의 응답 처리."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import hashlib
import json
import time
from pathlib import Path

from dotenv import load_dotenv

from sqlalchemy.dialects.postgresql import insert

from agent.llm import LLMError, make_llm
from agent.ports import ToolResult
from config import get_settings
from db.models import ApiCache
from db.session import transaction
from services.timeutil import now_utc
from tools.failure import classify, log_failure, user_reason

MOCK = Path(__file__).resolve().parents[1] / "mocks" / "demo" / "seoyeon_inputs.json"


def _current_building_payload(payload: dict | None) -> bool:
    """캐시된 건물 조회 결과가 지금 형식(원본 용도 코드·대상 공간 포함)인지."""
    from rules.building_use import SPACE_SCHEMA

    data = (payload or {}).get("data") or {}
    return data.get("schema") == SPACE_SCHEMA and isinstance(data.get("space"), dict)


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
        self._law_rag = None

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
            if row.source == "building" and not _current_building_payload(row.payload):
                return None  # 원본 용도 코드·대상 공간이 없는 옛 건물 캐시는 새 용도 매핑을 우회하므로 쓰지 않는다
            return ToolResult.model_validate(row.payload).model_copy(update={"from_cache": True})

    def _query(self, source, params, fetch, check_id=None):
        if self.use_mock:
            return self._mock(source, check_id)
        key = self._key(source, params)
        cached = self._cached(key, fresh=True)
        if cached is not None:
            return cached
        started = time.monotonic()
        failure = None
        try:
            result = fetch()
        except Exception as exc:  # noqa: BLE001 - 어떤 실패든 저장된 결과·예시 자료로 대체한다
            failure = classify(exc)
            result = ToolResult(ok=False, source=source, error="외부 조회 실패")
        if result.ok:
            # 모의·오래된 대체 결과를 새 실제 조회 결과로 캐시에 덮어쓰지 않는다.
            if not result.from_mock and not result.from_cache:
                now = now_utc()
                result = result.model_copy(update={"fetched_at": result.fetched_at or now})
                with transaction() as session:
                    stmt = insert(ApiCache).values(key=key, source=source, payload=result.model_dump(mode="json"),
                                                   fetched_at=result.fetched_at,
                                                   expires_at=now + timedelta(days=1 if source in ("law", "grants") else 7))
                    session.execute(stmt.on_conflict_do_update(index_elements=[ApiCache.key], set_={
                        "payload": stmt.excluded.payload, "fetched_at": stmt.excluded.fetched_at,
                        "expires_at": stmt.excluded.expires_at}))
            return result
        # 예외 없이 실패 결과를 돌려준 경우(예: 조문 지정 미확인)도 같은 방식으로 분류한다
        failure = failure or classify(ValueError(result.error or "PROVIDER_ERROR"))
        cached = self._cached(key)
        fallback = cached if cached is not None else self._mock(source, check_id)
        outcome = "cache" if cached is not None else ("mock" if fallback.ok else "failed")
        log_failure(source, failure, (time.monotonic() - started) * 1000, outcome)
        return fallback.model_copy(update={"reason": user_reason(source, failure), "substituted": True})

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

    def grants(self, store):
        """지원사업 공고. 같은 날·같은 시·도면 저장된 조회 결과를 쓴다."""
        from services.timeutil import today_kst
        from tools.kstartup import sido_of

        params = {"sido": sido_of(store.address), "day": today_kst().isoformat()}
        return self._query("grants", params, lambda: self.providers.grants(store))

    def rent(self, address: str):
        """임대료 통계. 같은 주소는 저장된 조회 결과(7일)를 쓴다 (분기 통계라 자주 바뀌지 않는다)."""
        # schema 2: 층별 임대료(floors)를 담는다. 층별이 없는 이전 저장 결과는 다시 쓰지 않는다
        # rules: 상권 매칭 규칙(rules/rent_areas.yaml)이 바뀌면 같은 주소라도 다시 조회한다 (#193)
        from tools.rent import areas_version

        params = {"address": address, "schema": 2, "rules": areas_version()}
        return self._query("rent", params, lambda: self.providers.rent(address))

    def trademark(self, name):
        return self._query("trademark", {"name": name}, lambda: self.providers.trademark(name))

    def _rag(self):
        """법령 RAG (저장된 조문 검색). 목 모드에서는 외부 호출(임베딩)을 하지 않고 키워드로만 찾는다."""
        if self._law_rag is None:
            from law_rag.embedder import make_embedder
            from law_rag.service import LawRag

            self._law_rag = LawRag(embedder=None if self.use_mock else make_embedder())
        return self._law_rag

    def _stored_law(self, check_id, store):
        started = time.monotonic()
        try:
            return self._rag().articles_for(check_id, store)
        except Exception as exc:  # noqa: BLE001 - 저장된 법령을 못 읽으면 공식 API 조회로 넘어간다
            log_failure("law_rag", classify(exc), (time.monotonic() - started) * 1000, "official_api")
            return None

    def _official_law(self, check_id):
        references = getattr(self.providers, "references", {}).get(check_id)
        return self._query("law", {"check_id": check_id, "references": references},
                           lambda: self.providers.law(check_id), check_id)

    def law(self, check_id, store=None):
        """저장된 법령 우선. 없으면 지정 조문을 조회한다."""
        found = self._stored_law(check_id, store) if get_settings().law_rag_enabled else None
        return found if found is not None else self._official_law(check_id)

    def discover_laws(self, store):
        """조문에서 의무 찾기용 조문 (저장된 법령만). 모의 모드·법령 RAG를 끈 경우에는 찾지 않는다 (모의 조문으로 의무를 만들지 않는다)."""
        if self.use_mock or not get_settings().law_rag_enabled:
            return None
        try:
            return self._rag().discover(store)
        except Exception:
            return None

    def laws_for(self, check_ids, store):
        """독립적인 법령 검색을 겹쳐 실행한다. 공식 API 대체 조회는 중복 요청 재사용을 위해 순서대로 한다."""
        check_ids = list(check_ids)
        results = {}
        settings = get_settings()
        # 분석 작업이 동시에 돌아도 법령 검색이 DB 연결 풀 전체를 쓰지 않도록 한다.
        workers = min(3, len(check_ids), 6 // settings.analysis_workers)
        if settings.law_rag_enabled and not self.use_mock and workers > 1:
            try:
                self._rag()  # 스레드에서 새 SDK 클라이언트를 동시에 만들지 않도록 먼저 준비한다
            except Exception:
                pass
            else:
                with ThreadPoolExecutor(max_workers=workers) as executor:
                    results = dict(zip(check_ids, executor.map(lambda cid: self._stored_law(cid, store), check_ids)))
        for check_id in check_ids:
            if results.get(check_id) is not None:
                continue
            try:
                results[check_id] = self._official_law(check_id) if check_id in results else self.law(check_id, store)
            except Exception as exc:
                results[check_id] = ToolResult(ok=False, source="국가법령정보", error=str(exc))
        return results

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
