"""하이브리드 조문 검색: 메타데이터 필터(법령명·현행) + 키워드(조각 본문) + 벡터 유사도(pgvector), 순위는 RRF 로 합친다.

벡터 유사도만으로 조문을 고르지 않는다. 법령명 필터는 항상 걸고, 규칙이 지정한 조문(pinned)은 검색과 상관없이 넣는다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

RRF_K = 60
CANDIDATES = 20


@dataclass
class Hit:
    article_id: str
    chunk_no: int
    law_name: str
    label: str
    title: str | None
    content: str
    url: str
    effective_date: date | None
    collected_at: datetime | None
    score: float = 0.0
    sources: set[str] = field(default_factory=set)  # vector | keyword | pinned


def _literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in vector) + "]"


_COLUMNS = """e.article_id::text AS article_id, e.chunk_no, l.name AS law_name, a.label, a.title, e.content,
              a.url, a.effective_date, l.collected_at"""
_FROM = """FROM law_embeddings e JOIN law_articles a ON a.id = e.article_id JOIN laws l ON l.id = a.law_id
           WHERE l.is_current AND l.name = ANY(:names)"""


def _hit(row, source: str) -> Hit:
    return Hit(row.article_id, row.chunk_no, row.law_name, row.label, row.title, row.content, row.url,
               row.effective_date, row.collected_at, sources={source})


def vector_search(session: Session, vector: list[float], names: list[str], model: str,
                  limit: int = CANDIDATES) -> list[Hit]:
    """같은 모델이 만든 벡터끼리만 비교한다 (모델이 다르면 벡터 공간이 달라 거리가 의미 없다)."""
    rows = session.execute(
        text(f"SELECT {_COLUMNS} {_FROM} AND e.embedding IS NOT NULL AND e.model = :model "
             "ORDER BY e.embedding <=> CAST(:q AS vector) LIMIT :limit"),
        {"q": _literal(vector), "names": names, "model": model, "limit": limit}).all()
    return [_hit(r, "vector") for r in rows]


def keyword_search(session: Session, keywords: list[str], names: list[str], limit: int = CANDIDATES) -> list[Hit]:
    """키워드가 조각 본문에 많이 나올수록 앞선다 (같으면 pg_trgm 유사도로 가른다)."""
    if not keywords:
        return []
    score = " + ".join(f"(CASE WHEN e.content ILIKE :k{i} THEN 1 ELSE 0 END)" for i in range(len(keywords)))
    params = {f"k{i}": f"%{kw}%" for i, kw in enumerate(keywords)}
    params |= {"names": names, "limit": limit, "q": " ".join(keywords)}
    rows = session.execute(
        text(f"SELECT {_COLUMNS}, ({score}) AS hits, similarity(e.content, :q) AS sim {_FROM} "
             f"AND ({score}) > 0 ORDER BY hits DESC, sim DESC LIMIT :limit"), params).all()
    return [_hit(r, "keyword") for r in rows]


def pinned_chunks(session: Session, pins: list[dict]) -> list[Hit]:
    """규칙이 지정한 조문({law_name, label})의 조각을 모두 가져온다."""
    if not pins:
        return []
    rows = session.execute(
        text(f"SELECT {_COLUMNS} "
             "FROM unnest(CAST(:names AS text[]), CAST(:labels AS text[])) WITH ORDINALITY AS p(name, label, position) "
             "JOIN laws l ON l.name = p.name AND l.is_current "
             "JOIN law_articles a ON a.law_id = l.id AND a.label = p.label "
             "JOIN law_embeddings e ON e.article_id = a.id ORDER BY p.position, e.chunk_no"),
        {"names": [pin["law_name"] for pin in pins], "labels": [pin["label"] for pin in pins]}).all()
    return [_hit(row, "pinned") for row in rows]


def search(session: Session, *, query: str, keywords: list[str], names: list[str], embedder=None,
           pins: list[dict] | None = None, top_k: int = 6) -> list[Hit]:
    """조각을 RRF 점수로 합쳐 상위 top_k 개를 돌려준다. 임베딩이 없거나 실패하면 키워드만 쓴다."""
    ranked: dict[tuple[str, int], Hit] = {}

    def add(hits: list[Hit]) -> None:
        for rank, hit in enumerate(hits, start=1):
            key = (hit.article_id, hit.chunk_no)
            current = ranked.setdefault(key, hit)
            current.score += 1.0 / (RRF_K + rank)
            current.sources |= hit.sources

    if embedder is not None:
        try:
            add(vector_search(session, embedder.embed_query(query), names, embedder.model))
        except Exception as exc:
            logger.warning("벡터 검색을 건너뜁니다: %s", exc)
    add(keyword_search(session, keywords, names))

    chosen = sorted(ranked.values(), key=lambda h: h.score, reverse=True)[:top_k]
    seen = {(h.article_id, h.chunk_no) for h in chosen}
    for hit in pinned_chunks(session, pins or []):
        if (hit.article_id, hit.chunk_no) not in seen:
            seen.add((hit.article_id, hit.chunk_no))
            chosen.append(hit)
    return chosen


MAX_ARTICLE_TEXT = 2800  # 판정 AI가 조문마다 앞 3,000자만 읽으므로 그 안에 관련도 높은 조각이 들어가게 한다


def merge_by_article(hits: list[Hit], max_chars: int = MAX_ARTICLE_TEXT) -> list[dict]:
    """같은 조문의 조각을 한 항목으로 합친다 (판정 AI는 "법령명 조문"을 키로 쓰므로 키가 겹치면 안 된다).

    조각은 관련도 순으로 이어 붙이고 max_chars 를 넘기는 조각은 뺀다. 첫 조각은 길어도 항상 넣는다.
    고정 조문(pinned)은 전부 넣는다.
    """
    grouped: dict[tuple[str, str], list[Hit]] = {}
    for hit in hits:
        grouped.setdefault((hit.law_name, hit.label), []).append(hit)
    articles = []
    for (law_name, label), parts in grouped.items():
        pinned = [p for p in parts if "pinned" in p.sources]
        ordered = sorted(parts, key=lambda h: (h.score, -h.chunk_no), reverse=True)
        chosen: list[Hit] = []
        size = 0
        for part in pinned + [p for p in ordered if p not in pinned]:
            if chosen and size + len(part.content) > max_chars and "pinned" not in part.sources:
                continue
            chosen.append(part)
            size += len(part.content) + 1
        chosen.sort(key=lambda h: (h.article_id, h.chunk_no))
        articles.append({
            "law_name": law_name, "article": label, "text": "\n".join(p.content for p in chosen),
            "url": parts[0].url, "title": parts[0].title,
            "effective_date": parts[0].effective_date.isoformat() if parts[0].effective_date else None,
            "score": round(max(p.score for p in parts), 5), "retrieved_by": sorted({s for p in parts for s in p.sources}),
        })
    articles.sort(key=lambda a: a["score"], reverse=True)
    return articles
