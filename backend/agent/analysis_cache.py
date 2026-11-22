"""짧게 재사용하는 검증된 분석 응답. 조회·근거 확인·규칙 병합은 실행마다 수행한다."""

from collections import OrderedDict
import hashlib
import json
from threading import Lock
import time

from pydantic import BaseModel


class AnalysisResponseCache:
    def __init__(self, *, capacity=1024, ttl_seconds=3600, clock=time.monotonic):
        self._entries: OrderedDict[bytes, tuple[float, BaseModel]] = OrderedDict()
        self._capacity = capacity
        self._ttl = ttl_seconds
        self._clock = clock
        self._lock = Lock()

    def get(self, key):
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            expires_at, response = entry
            if expires_at <= self._clock():
                del self._entries[key]
                return None
            self._entries.move_to_end(key)
        return response.model_copy(deep=True)

    def put(self, key, response):
        snapshot = response.model_copy(deep=True)
        with self._lock:
            self._entries[key] = (self._clock() + self._ttl, snapshot)
            self._entries.move_to_end(key)
            while len(self._entries) > self._capacity:
                self._entries.popitem(last=False)


class CachedAnalysisLLM:
    def __init__(self, inner, cache: AnalysisResponseCache, store_id: str):
        self.inner, self.cache, self.store_id = inner, cache, store_id
        self._pending: tuple[bytes, BaseModel] | None = None

    @property
    def cost(self):
        return getattr(self.inner, "cost", None)

    def parse(self, *, step, tier, system, user, schema):
        self._pending = None
        identity = self.inner.analysis_cache_identity(tier)
        key = hashlib.sha256(json.dumps([
            self.store_id, identity, step, tier, system, user, schema.model_json_schema(),
        ], ensure_ascii=False, separators=(",", ":")).encode()).digest()
        response = self.cache.get(key)
        if response is not None:
            return response
        response = self.inner.parse(step=step, tier=tier, system=system, user=user, schema=schema)
        self._pending = (key, response)
        return response

    def accept_response(self, response):
        if self._pending is not None and self._pending[1] is response:
            self.cache.put(*self._pending)
            self._pending = None


def accept_response(llm, response):
    accept = getattr(llm, "accept_response", None)
    if accept is not None:
        accept(response)
