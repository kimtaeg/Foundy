"""점검 항목별로 저장된 법령에서 근거 조문을 검색해 ToolResult 로 돌려준다 (tools.law 의 RAG 구현)."""

from __future__ import annotations

import logging
from datetime import timezone

from sqlalchemy import select

from agent.ports import ToolResult
from db.models import ApplicabilityRule, Law, LawArticle, LawEmbedding
from db.session import transaction
from law_rag import retriever
from rules.applicability import floor_from_detail
from rules.engine import derive_business_type, load_pack
from services.timeutil import now_utc

logger = logging.getLogger(__name__)

SOURCE = "국가법령정보센터 (저장된 조문 검색)"


def _current_laws(names: list[str]):
    return select(Law.id).where(Law.is_current, Law.name.in_(names))


class LawRag:
    def __init__(self, embedder=None, pack: dict | None = None):
        self.embedder = embedder
        self.pack = pack or load_pack("cafe_restaurant")

    def spec(self, check_id: str) -> dict | None:
        return (self.pack.get("law_rag") or {}).get("checks", {}).get(check_id)

    def has_data(self, names: list[str]) -> bool:
        with transaction() as session:
            return bool(session.scalar(select(_current_laws(names).exists())))

    def _query(self, spec: dict, store) -> str:
        answers = (getattr(store, "answers", None) or {}) if store is not None else {}
        area = getattr(store, "area_sqm", None) if store is not None else None
        floor = floor_from_detail(getattr(store, "address_detail", None)) if store is not None else None
        text = spec["query"]
        if "{business_type}" in text:
            text = text.format(business_type=derive_business_type(self.pack, answers) or "음식점")
        extras = [f"영업장 면적 {float(area):g}제곱미터"] if area else []
        if floor is not None:
            extras.append(f"{abs(floor)}층" if floor > 0 else f"지하 {abs(floor)}층")
        if answers.get("sells_alcohol"):
            extras.append("주류 판매")
        if answers.get("does_delivery"):
            extras.append("배달 영업")
        return " ".join([text, *extras])

    def articles_for(self, check_id: str, store=None) -> ToolResult | None:
        """저장된 법령에서 근거 조문을 찾는다. 설정이 없거나 저장된 법령이 없으면 None (호출한 쪽이 기존 방식으로 대체)."""
        spec = self.spec(check_id)
        if not spec:
            return None
        try:
            with transaction() as session:
                current = _current_laws(spec["laws"])
                embedder = self.embedder
                if embedder is None:
                    if not session.scalar(select(current.exists())):
                        return None
                else:
                    indexed = (current.join(LawArticle).join(LawEmbedding).where(
                        LawEmbedding.embedding.is_not(None), LawEmbedding.model == embedder.model))
                    available, has_vectors = session.execute(select(current.exists(), indexed.exists())).one()
                    if not available:
                        return None
                    if not has_vectors:
                        embedder = None
                hits = retriever.search(
                    session, query=self._query(spec, store), keywords=spec.get("keywords", []), names=spec["laws"],
                    embedder=embedder, pins=spec.get("pins"), top_k=spec.get("top_k", 6))
        except Exception as exc:
            logger.warning("조문 검색 실패(%s): %s", check_id, type(exc).__name__)
            return ToolResult(ok=False, source=SOURCE, error="조문 검색 실패")
        if not hits:
            return ToolResult(ok=False, source=SOURCE, error="LAW_NOT_FOUND")
        articles = retriever.merge_by_article(hits)
        collected = max((h.collected_at for h in hits if h.collected_at), default=now_utc())
        if collected.tzinfo is None:
            collected = collected.replace(tzinfo=timezone.utc)
        return ToolResult(ok=True, source=SOURCE, fetched_at=collected, data={"articles": articles})


    def discover(self, store=None) -> ToolResult | None:
        """조문에서 의무 찾기(law_rag.discovery)용 조문. 검색 묶음마다 찾아 조문 단위로 합친다. 설정·저장된 법령이 없으면 None."""
        conf = (self.pack.get("law_rag") or {}).get("discovery") or {}
        answers = (getattr(store, "answers", None) or {}) if store is not None else {}
        specs = [q for q in conf.get("queries", []) if not q.get("when") or answers.get(q["when"])]
        if not specs:
            return None
        per_query: list[list[dict]] = []
        collected = None
        max_chars = int(conf.get("max_article_chars", 2500))  # 별표처럼 긴 표는 여러 조각을 함께 읽어야 의무가 보인다
        try:
            with transaction() as session:
                for spec in specs:
                    hits = retriever.search(
                        session, query=self._query(spec, store), keywords=spec.get("keywords", []), names=spec["laws"],
                        embedder=self.embedder, pins=spec.get("pins"), top_k=spec.get("top_k", 4))
                    per_query.append(retriever.merge_by_article(hits, max_chars=max_chars))
                    stamps = [h.collected_at for h in hits if h.collected_at]
                    if stamps:
                        collected = max([collected, *stamps] if collected else stamps)
        except Exception as exc:
            logger.warning("의무 찾기 조문 검색 실패: %s", type(exc).__name__)
            return ToolResult(ok=False, source=SOURCE, error="조문 검색 실패")
        # 검색 묶음을 번갈아 합친다 (앞 묶음의 조문만으로 개수 제한이 차서 뒤 묶음(근로·주류 등)이 빠지지 않게)
        found: dict[tuple[str, str], dict] = {}
        for rank in range(max((len(q) for q in per_query), default=0)):
            for arts in per_query:
                if rank < len(arts):
                    found.setdefault((arts[rank]["law_name"], arts[rank]["article"]), arts[rank])
        if not found:
            return ToolResult(ok=False, source=SOURCE, error="LAW_NOT_FOUND")
        collected = collected or now_utc()
        if collected.tzinfo is None:
            collected = collected.replace(tzinfo=timezone.utc)
        return ToolResult(ok=True, source=SOURCE, fetched_at=collected, data={"articles": list(found.values())})


def sync_rules(pack: dict | None = None) -> int:
    """규칙 묶음의 적용 조건 규칙을 DB 사본(applicability_rules)에 맞춘다. 검토 상태는 DB에 남은 값을 지키되 YAML 이 reviewed 면 따른다."""
    pack = pack or load_pack("cafe_restaurant")
    rules = pack.get("applicability_rules") or []
    with transaction() as session:
        existing = {r.rule_id: r for r in session.scalars(select(ApplicabilityRule))}
        for rule in rules:
            law = rule.get("law") or {}
            values = dict(
                title=rule["title"], check_id=rule.get("check_id"), law_name=law.get("law_name", ""),
                article_label=law.get("label"), conditions=rule.get("conditions") or {},
                exceptions=rule.get("exceptions") or [], required_inputs=list((rule.get("conditions") or {}).keys()),
                required_action=rule.get("required_action"), pack=pack["pack"], updated_at=now_utc())
            row = existing.get(rule["rule_id"])
            if row is None:
                session.add(ApplicabilityRule(rule_id=rule["rule_id"], review_status=rule.get("review_status", "draft"),
                                              reviewed_by=rule.get("reviewed_by"), **values))
            else:
                for key, value in values.items():
                    setattr(row, key, value)
                if rule.get("review_status") == "reviewed":
                    row.review_status, row.reviewed_by = "reviewed", rule.get("reviewed_by")
        ids = {r["rule_id"] for r in rules}
        for rule_id, row in existing.items():
            if row.pack == pack["pack"] and rule_id not in ids:
                session.delete(row)
    return len(rules)
