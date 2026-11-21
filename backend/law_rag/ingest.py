"""법령 수집 명령. 실행: cd backend && python -m law_rag.ingest [--mock] [--no-embed] [--only 법령명 ...]

- 기본: 규칙 묶음 law_sources 의 현행 법령을 법제처 API 에서 받아 저장한다 (OC 에 등록된 IP 에서만 가능).
- --mock: mocks/ 에 저장해 둔 실제 응답(식품위생법·건축법 시행령)으로 저장한다. 법제처에 접속하지 않는다.
- --no-embed: 임베딩을 만들지 않는다 (키워드 검색만 가능). 나중에 같은 명령을 다시 실행하면 임베딩 없는 조문은 건너뛰므로 --reembed 를 쓴다.
- --reembed: 저장된 조문 중 임베딩이 없는 조각만 다시 만든다.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import select

from db.models import Law, LawArticle, LawEmbedding
from db.session import transaction
from law_rag.changes import apply_parsed, refresh
from law_rag.chunker import embed_text
from law_rag.collector import LawCollector
from law_rag.embedder import make_embedder
from law_rag.parser import parse_law
from law_rag.service import sync_rules
from rules.engine import load_pack

MOCKS = Path(__file__).resolve().parents[1] / "mocks"
# (본문 파일, 검색 결과 파일의 법령일련번호를 쓸 법령명)
MOCK_BODIES = [("law_body.json", "식품위생법"), ("law_building_decree_body.json", "건축법 시행령")]


def ingest_mocks(embedder, embed: bool) -> list:
    search = json.loads((MOCKS / "law_search.json").read_text(encoding="utf-8"))["LawSearch"]["law"]
    mst_by_name = {r["법령명한글"]: str(r["법령일련번호"]) for r in search}
    results = []
    for filename, name in MOCK_BODIES:
        payload = json.loads((MOCKS / filename).read_text(encoding="utf-8"))
        parsed = parse_law(payload, mst=mst_by_name.get(name))
        result, _ = apply_parsed(parsed, embedder, embed=embed)
        results.append(result)
    return results


def reembed(embedder) -> int:
    """임베딩이 없는 조각을 채운다."""
    if embedder is None:
        return 0
    filled = 0
    with transaction() as session:
        rows = session.execute(
            select(LawEmbedding, LawArticle, Law).join(LawArticle, LawArticle.id == LawEmbedding.article_id)
            .join(Law, Law.id == LawArticle.law_id).where(LawEmbedding.embedding.is_(None))).all()
        for start in range(0, len(rows), 50):
            batch = rows[start:start + 50]
            vectors = embedder.embed_documents([embed_text(l.name, a.label, a.title, e.content) for e, a, l in batch])
            for (e, _, _), vector in zip(batch, vectors):
                e.embedding, e.model = vector, embedder.model
                filled += 1
    return filled


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mock", action="store_true")
    ap.add_argument("--no-embed", action="store_true")
    ap.add_argument("--reembed", action="store_true")
    ap.add_argument("--only", nargs="*", help="이 법령명만 받는다")
    args = ap.parse_args(argv)

    embedder = None if args.no_embed else make_embedder()
    if embedder is None and not args.no_embed:
        print("LLM_API_KEY 가 없어 임베딩 없이(키워드 검색만) 저장합니다.")
    print(f"규칙 {sync_rules()}개를 DB에 맞췄습니다.")

    if args.reembed:
        print(f"임베딩 {reembed(embedder)}개를 채웠습니다.")
        return 0
    if args.mock:
        results = ingest_mocks(embedder, not args.no_embed)
        for r in results:
            print(f"{r.law_name}: {r.change} (조문 {len(r.changed_articles)}건, 조각 {r.embedded_chunks}개)")
        return 0

    names = args.only or load_pack("cafe_restaurant")["law_sources"]
    collector = LawCollector()
    try:
        report = refresh(collector, names, embedder)
    finally:
        collector.close()
    for r in report.results:
        print(f"{r.law_name}: {r.change} (바뀐 조문 {len(r.changed_articles)}건, 조각 {r.embedded_chunks}개)")
    for name, reason in report.failed:
        print(f"실패 {name}: {reason}", file=sys.stderr)
    print(f"알림 {report.alerts_created}건")
    return 1 if report.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
