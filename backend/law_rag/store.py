"""파싱한 법령을 DB에 저장한다: 법령·조문 upsert, 바뀐 조문 이력, 조각 임베딩. 바뀐 것만 다시 임베딩한다."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from db.models import Law, LawArticle, LawArticleHistory, LawEmbedding
from law_rag.chunker import chunk_text, embed_text
from law_rag.embedder import BATCH, EmbeddingResponseError, validate_vectors
from law_rag.parser import ParsedLaw

logger = logging.getLogger(__name__)


@dataclass
class IngestResult:
    law_key: str
    law_name: str
    change: str                       # added | updated | unchanged
    old_mst: str | None = None
    new_mst: str | None = None
    old_effective: object = None
    new_effective: object = None
    changed_articles: list[dict] = field(default_factory=list)  # [{label, change: added|changed|removed}]
    embedded_chunks: int = 0


def _embed_batch(embedder, law_name: str, batch: list[tuple[LawEmbedding, str]]) -> None:
    try:
        vectors = embedder.embed_documents([text for _, text in batch])
        validate_vectors(vectors, len(batch))
    except Exception as exc:  # 임베딩이 실패해도 원문으로 검색할 수 있다.
        error = exc.__cause__ or exc
        # A rejected item should not make other articles in the same batch lose their vectors.
        if (isinstance(error, EmbeddingResponseError) or type(error).__name__ == "BadRequestError"
                or getattr(error, "code", None) == 400):
            by_article = {}
            for item in batch:
                by_article.setdefault(item[0].article_id, []).append(item)
            if len(by_article) > 1:
                for article_chunks in by_article.values():
                    _embed_batch(embedder, law_name, article_chunks)
                return
        logger.warning("%s 조각 %d개 임베딩 실패: %s", law_name, len(batch), type(error).__name__)
        return
    for (chunk, _), vector in zip(batch, vectors, strict=True):
        chunk.embedding, chunk.model = vector, embedder.model


def _replace_chunks(session: Session, changes: list[tuple[LawArticle, bool]], law_name: str, embedder) -> int:
    if not changes:
        return 0
    session.flush()  # 새 조문의 ID를 한 번에 받은 뒤 조각을 연결한다.
    reusable_ids = [article.id for article, can_reuse in changes if can_reuse]
    saved = {}
    if embedder is not None and reusable_ids:
        rows = session.execute(select(LawEmbedding.article_id, LawEmbedding.content, LawEmbedding.embedding).where(
            LawEmbedding.article_id.in_(reusable_ids), LawEmbedding.model == embedder.model,
            LawEmbedding.embedding.is_not(None),
        ))
        saved = {(article_id, chunk): vector for article_id, chunk, vector in rows}

    chunks = []
    pending = []
    for article, _ in changes:
        parts = chunk_text(article.content, keep_heading=article.label.startswith("별표"))
        for index, part in enumerate(parts):
            vector = saved.get((article.id, part))
            row = LawEmbedding(article_id=article.id, chunk_no=index, content=part,
                               model=embedder.model if vector is not None else "keyword-only", embedding=vector)
            chunks.append(row)
            if embedder is not None and vector is None:
                pending.append((row, embed_text(law_name, article.label, article.title, part)))
    for start in range(0, len(pending), BATCH):
        _embed_batch(embedder, law_name, pending[start:start + BATCH])

    session.execute(delete(LawEmbedding).where(LawEmbedding.article_id.in_([article.id for article, _ in changes])))
    session.add_all(chunks)
    return len(chunks)


def save_law(session: Session, parsed: ParsedLaw, embedder=None, embed: bool = True) -> IngestResult:
    """법령 한 건을 저장한다. 같은 버전·같은 본문이면 아무것도 바꾸지 않는다."""
    # Concurrent refreshes of one law must compare against the latest committed revision.
    session.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(f"law-rag:{parsed.law_key}", 0))))
    existing = session.scalar(select(Law).where(Law.law_key == parsed.law_key))
    body_hash = parsed.body_hash
    if existing is not None and existing.mst == parsed.mst and existing.body_hash == body_hash:
        return IngestResult(parsed.law_key, parsed.name, "unchanged", existing.mst, existing.mst)

    result = IngestResult(parsed.law_key, parsed.name, "added" if existing is None else "updated",
                          existing.mst if existing else None, parsed.mst,
                          existing.effective_date if existing else None, parsed.effective_date)
    old_name = existing.name if existing else None
    if existing is None:
        law = Law(law_key=parsed.law_key, name=parsed.name, law_type=parsed.law_type, mst=parsed.mst,
                  promulgation_no=parsed.promulgation_no, effective_date=parsed.effective_date,
                  ministry=parsed.ministry, source_url=parsed.source_url, body_hash=body_hash)
        session.add(law)
        session.flush()
    else:
        law = existing
        law.name, law.law_type, law.mst = parsed.name, parsed.law_type, parsed.mst
        law.promulgation_no, law.effective_date, law.ministry = parsed.promulgation_no, parsed.effective_date, parsed.ministry
        law.source_url, law.body_hash, law.is_current = parsed.source_url, body_hash, True
        from services.timeutil import now_utc

        law.collected_at = law.updated_at = now_utc()

    old = {(a.kind, a.number, a.branch): a for a in session.scalars(select(LawArticle).where(LawArticle.law_id == law.id))}
    new_keys = set()
    chunks_to_replace = []
    for art in parsed.articles:
        key = (art.kind, art.number, art.branch)
        new_keys.add(key)
        row = old.get(key)
        if row is None:
            row = LawArticle(law_id=law.id, kind=art.kind, number=art.number, branch=art.branch, label=art.label,
                             title=art.title, content=art.content, effective_date=art.effective_date,
                             url=parsed.source_url, content_hash=art.content_hash)
            session.add(row)
            result.changed_articles.append({"label": art.label, "change": "added"})
            chunks_to_replace.append((row, False))
        else:
            same_heading = (old_name, row.label, row.title) == (parsed.name, art.label, art.title)
            same_body = row.content_hash == art.content_hash
            if same_body and same_heading:
                row.effective_date, row.url = art.effective_date, parsed.source_url
                continue
            if not same_body or (row.label, row.title) != (art.label, art.title):
                session.add(LawArticleHistory(law_name=parsed.name, label=row.label, mst=result.old_mst or parsed.mst,
                                              effective_date=row.effective_date, content=row.content,
                                              content_hash=row.content_hash))
                result.changed_articles.append({"label": art.label, "change": "changed"})
            row.label, row.title, row.content = art.label, art.title, art.content
            row.content_hash = art.content_hash
            row.effective_date, row.url = art.effective_date, parsed.source_url
            chunks_to_replace.append((row, same_heading))
    result.embedded_chunks = _replace_chunks(session, chunks_to_replace, parsed.name, embedder if embed else None)
    for key, row in old.items():
        if key not in new_keys:
            session.add(LawArticleHistory(law_name=parsed.name, label=row.label, mst=result.old_mst or parsed.mst,
                                          effective_date=row.effective_date, content=row.content,
                                          content_hash=row.content_hash))
            session.delete(row)
            result.changed_articles.append({"label": row.label, "change": "removed"})
    session.flush()
    return result
