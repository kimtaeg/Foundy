"""주입 가능한 캐시 계약. DB 구현은 같은 get/put 경계를 제공하면 된다."""

from dataclasses import dataclass
from datetime import datetime
from threading import Lock
from typing import Protocol

from agent.ports import ToolResult


@dataclass(frozen=True)
class CacheEntry:
    result: ToolResult
    expires_at: datetime


class ToolCache(Protocol):
    def get(self, key: str) -> CacheEntry | None: ...
    def put(self, key: str, result: ToolResult, expires_at: datetime) -> None: ...


class MemoryCache:
    """실패 후 사용할 만료 항목도 유지한다. 프로세스 간 공유·영속성은 없다."""

    def __init__(self):
        self._entries: dict[str, CacheEntry] = {}
        self._lock = Lock()

    def get(self, key: str) -> CacheEntry | None:
        with self._lock:
            entry = self._entries.get(key)
            return CacheEntry(entry.result.model_copy(deep=True), entry.expires_at) if entry else None

    def put(self, key: str, result: ToolResult, expires_at: datetime) -> None:
        with self._lock:
            self._entries[key] = CacheEntry(result.model_copy(deep=True), expires_at)
