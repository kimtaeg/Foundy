"""조문 조각·검색 문장 임베딩. 운영은 Gemini, 키가 없거나 테스트에서는 해시 기반 대역을 쓴다."""

from __future__ import annotations

import hashlib
import logging
import math
import os
import re
import time
from collections import OrderedDict
from concurrent.futures import Future
from functools import lru_cache
from threading import Lock
from typing import Callable

logger = logging.getLogger(__name__)

DIM = 768
GEMINI_MODEL = "gemini-embedding-001"
BATCH = 50
_QUERY_CACHE_SIZE = 256
_QUERY_CACHE_SECONDS = 900
_provider_lock = Lock()


class EmbeddingResponseError(RuntimeError):
    """The provider returned an incomplete or invalid embedding batch."""


def validate_vectors(vectors, expected: int) -> None:
    if len(vectors) != expected or any(
        len(vector) != DIM or not all(math.isfinite(value) for value in vector) for vector in vectors
    ):
        raise EmbeddingResponseError("임베딩 응답의 개수 또는 차원이 올바르지 않습니다")


class _QueryCache:
    def __init__(self):
        self._lock = Lock()
        self._ready: OrderedDict[str, tuple[float, tuple[float, ...]]] = OrderedDict()
        self._pending: dict[str, Future[tuple[float, ...]]] = {}

    def get(self, text: str, compute: Callable[[], list[float]]) -> list[float]:
        with self._lock:
            if (entry := self._ready.pop(text, None)) is not None and entry[0] > time.monotonic():
                self._ready[text] = entry
                return list(entry[1])
            running = (pending := self._pending.get(text)) is not None
            if pending is None:
                pending = self._pending[text] = Future()
        if running:
            return list(pending.result())
        try:
            vector = tuple(compute())
        except BaseException as exc:
            with self._lock:
                self._pending.pop(text)
                pending.set_exception(exc)
            raise
        with self._lock:
            self._pending.pop(text)
            self._ready[text] = (time.monotonic() + _QUERY_CACHE_SECONDS, vector)
            if len(self._ready) > _QUERY_CACHE_SIZE:
                self._ready.popitem(last=False)
            pending.set_result(vector)
        return list(vector)


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


class GeminiEmbedder:
    """google-genai 임베딩. 768차원으로 줄여 쓰므로 길이를 1로 맞춘다 (코사인 거리용)."""

    model = GEMINI_MODEL

    def __init__(self, api_key: str, retries: int = 3):
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._retries = retries
        self._queries = _QueryCache()

    def _embed(self, texts: list[str], task: str) -> list[list[float]]:
        last: Exception | None = None
        for attempt in range(self._retries):
            try:
                response = self._client.models.embed_content(
                    model=GEMINI_MODEL, contents=texts, config={"output_dimensionality": DIM, "task_type": task})
                vectors = [list(e.values or []) for e in (response.embeddings or [])]
                validate_vectors(vectors, len(texts))
                return [_normalize(vector) for vector in vectors]
            except Exception as exc:  # 429·일시 장애는 잠깐 쉬었다 다시 시도한다
                last = exc
                if getattr(exc, "code", None) in (400, 401, 403):
                    break
                if attempt + 1 < self._retries:
                    time.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"임베딩 실패: {type(last).__name__}") from last

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), BATCH):
            out += self._embed(texts[i:i + BATCH], "RETRIEVAL_DOCUMENT")
        return out

    def embed_query(self, text: str) -> list[float]:
        return self._queries.get(text, lambda: self._embed([text], "RETRIEVAL_QUERY")[0])


class OpenAIEmbedder:
    """OpenAI 임베딩(text-embedding-3-large 등). `dimensions`로 768차원으로 줄여 vector(768)에 맞춘다.
    base_url 을 주면 OpenAI 호환 서비스도 쓸 수 있다."""

    def __init__(self, api_key: str, model: str = "text-embedding-3-large", base_url: str | None = None,
                 retries: int = 3, client=None):
        self.model = model
        self._retries = retries
        self._queries = _QueryCache()
        if client is not None:
            self._client = client
        else:
            from openai import OpenAI

            self._client = OpenAI(api_key=api_key, base_url=base_url or None)

    def _embed(self, texts: list[str]) -> list[list[float]]:
        last: Exception | None = None
        for attempt in range(self._retries):
            try:
                response = self._client.embeddings.create(model=self.model, input=texts, dimensions=DIM)
                ordered = sorted(response.data or [], key=lambda item: item.index)
                if [item.index for item in ordered] != list(range(len(texts))):
                    raise EmbeddingResponseError("임베딩 응답의 입력 순서가 올바르지 않습니다")
                vectors = [list(item.embedding) for item in ordered]
                validate_vectors(vectors, len(texts))
                return [_normalize(vector) for vector in vectors]
            except Exception as exc:  # 429·일시 장애는 잠깐 쉬었다 다시 시도한다 (인증 오류는 바로 멈춘다)
                last = exc
                if type(exc).__name__ in ("AuthenticationError", "PermissionDeniedError", "BadRequestError"):
                    break
                if attempt + 1 < self._retries:
                    time.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"임베딩 실패: {type(last).__name__}") from last

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), BATCH):
            out += self._embed(texts[i:i + BATCH])
        return out

    def embed_query(self, text: str) -> list[float]:
        return self._queries.get(text, lambda: self._embed([text])[0])


class HashEmbedder:
    """테스트·오프라인용 대역: 글자 2·3-gram 해시를 768차원 벡터로 만든다. 겹치는 글자가 많을수록 가깝다."""

    model = "hash-ngram-768"

    @staticmethod
    def _vector(text: str) -> list[float]:
        clean = re.sub(r"\s+", "", text)
        vec = [0.0] * DIM
        for n in (2, 3):
            for i in range(len(clean) - n + 1):
                h = int(hashlib.md5(clean[i:i + n].encode()).hexdigest()[:8], 16)
                vec[h % DIM] += 1.0
        return _normalize(vec)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vector(text)


@lru_cache(maxsize=4)
def _provider(provider: str, key: str, model: str, base_url: str | None, _sdk_scope: tuple[str | None, ...]):
    if provider == "openai":
        return OpenAIEmbedder(key, model, base_url)
    return GeminiEmbedder(key)


def make_embedder():
    """EMBEDDING_API_KEY 가 있으면 OpenAI(기본 text-embedding-3-large, EMBEDDING_MODEL·EMBEDDING_BASE_URL 로 바꿀 수 있다),
    없으면 LLM_API_KEY 의 Gemini, 둘 다 없으면 None (그러면 임베딩 없이 키워드 검색만 한다)."""
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=False)
    embedding_key = os.getenv("EMBEDDING_API_KEY", "").strip()
    if embedding_key:
        try:
            # Pass the SDK's own endpoint override explicitly so it also scopes the cache.
            base_url = os.getenv("EMBEDDING_BASE_URL", "").strip() or os.getenv("OPENAI_BASE_URL") or None
            model = os.getenv("EMBEDDING_MODEL", "").strip() or "text-embedding-3-large"
            sdk_scope = (os.getenv("OPENAI_ORG_ID"), os.getenv("OPENAI_PROJECT_ID"))
            with _provider_lock:
                return _provider("openai", embedding_key, model, base_url, sdk_scope)
        except Exception:
            logger.warning("OpenAI 임베딩 클라이언트를 만들지 못했습니다")
            return None
    key = os.getenv("LLM_API_KEY", "").strip()
    provider = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    if not key or provider != "gemini":
        return None
    try:
        sdk_scope = tuple(os.getenv(name) for name in (
            "GOOGLE_GEMINI_BASE_URL", "GOOGLE_VERTEX_BASE_URL", "GOOGLE_GENAI_USE_VERTEXAI",
            "GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION",
        ))
        with _provider_lock:
            return _provider("gemini", key, GEMINI_MODEL, None, sdk_scope)
    except Exception:
        logger.warning("임베딩 클라이언트를 만들지 못했습니다")
        return None
