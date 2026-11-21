"""파싱한 법령을 DB에 저장한다: 법령·조문 upsert, 바뀐 조문 이력, 조각 임베딩. 바뀐 것만 다시 임베딩한다."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from db.models import Law, LawArticle, LawArticleHistory, LawEmbedding
from law_rag.chunker import chunk_text, embed_text
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


def _embed_chunks(session: Session, article: LawArticle, law_name: str, title: str | None, embedder) -> int:
    chunks = chunk_text(article.content, keep_heading=article.label.startswith("별표"))
    vectors: list = [None] * len(chunks)
    model = "keyword-only"
    if embedder is not None:
        try:
            vectors = embedder.embed_documents([embed_text(law_name, article.label, title, c) for c in chunks])
            model = embedder.model
        except Exception as exc:  # 임베딩이 실패해도 원문은 저장한다 (키워드 검색은 된다)
            logger.warning("%s %s 임베딩 실패: %s", law_name, article.label, exc)
            vectors = [None] * len(chunks)
    session.execute(delete(LawEmbedding).where(LawEmbedding.article_id == article.id))
    for number, (chunk, vector) in enumerate(zip(chunks, vectors)):
        session.add(LawEmbedding(article_id=article.id, chunk_no=number, content=chunk, model=model, embedding=vector))
    return len(chunks)


def save_law(session: Session, parsed: ParsedLaw, embedder=None, embed: bool = True) -> IngestResult:
    """법령 한 건을 저장한다. 같은 버전·같은 본문이면 아무것도 바꾸지 않는다."""
    existing = session.scalar(select(Law).where(Law.law_key == parsed.law_key))
    body_hash = parsed.body_hash
    if existing is not None and existing.mst == parsed.mst and existing.body_hash == body_hash:
        return IngestResult(parsed.law_key, parsed.name, "unchanged", existing.mst, existing.mst)

    result = IngestResult(parsed.law_key, parsed.name, "added" if existing is None else "updated",
                          existing.mst if existing else None, parsed.mst,
                          existing.effective_date if existing else None, parsed.effective_date)
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
    for art in parsed.articles:
        key = (art.kind, art.number, art.branch)
        new_keys.add(key)
        row = old.get(key)
        if row is not None and row.content_hash == art.content_hash:
            row.effective_date, row.title = art.effective_date, art.title
            continue
        if row is None:
            row = LawArticle(law_id=law.id, kind=art.kind, number=art.number, branch=art.branch, label=art.label,
                             title=art.title, content=art.content, effective_date=art.effective_date,
                             url=parsed.source_url, content_hash=art.content_hash)
            session.add(row)
            session.flush()
            result.changed_articles.append({"label": art.label, "change": "added"})
        else:
            session.add(LawArticleHistory(law_name=parsed.name, label=row.label, mst=result.old_mst or parsed.mst,
                                          effective_date=row.effective_date, content=row.content,
                                          content_hash=row.content_hash))
            row.title, row.content, row.content_hash = art.title, art.content, art.content_hash
            row.effective_date, row.url = art.effective_date, parsed.source_url
            result.changed_articles.append({"label": art.label, "change": "changed"})
        # 조각은 항상 만든다 (키워드 검색용). embed=False 면 벡터만 비워 둔다.
        result.embedded_chunks += _embed_chunks(session, row, parsed.name, art.title, embedder if embed else None)
    for key, row in old.items():
        if key not in new_keys:
            session.add(LawArticleHistory(law_name=parsed.name, label=row.label, mst=result.old_mst or parsed.mst,
                                          effective_date=row.effective_date, content=row.content,
                                          content_hash=row.content_hash))
            session.delete(row)
            result.changed_articles.append({"label": row.label, "change": "removed"})
    session.flush()
    return result
