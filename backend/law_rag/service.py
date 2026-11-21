"""점검 항목별로 저장된 법령에서 근거 조문을 검색해 ToolResult 로 돌려준다 (tools.law 의 RAG 구현)."""

from __future__ import annotations

import logging
from datetime import timezone

from sqlalchemy import func, select

from agent.ports import ToolResult
from db.models import ApplicabilityRule, Law
from db.session import transaction
from law_rag import retriever
from rules.applicability import floor_from_detail
from rules.engine import derive_business_type, load_pack
from services.timeutil import now_utc

logger = logging.getLogger(__name__)

SOURCE = "국가법령정보센터 (저장된 조문 검색)"


class LawRag:
    def __init__(self, embedder=None, pack: dict | None = None):
        self.embedder = embedder
        self.pack = pack or load_pack("cafe_restaurant")

    def spec(self, check_id: str) -> dict | None:
        return (self.pack.get("law_rag") or {}).get("checks", {}).get(check_id)

    def has_data(self, names: list[str]) -> bool:
        with transaction() as session:
            return bool(session.scalar(
                select(func.count()).select_from(Law).where(Law.is_current, Law.name.in_(names))))

    def _query(self, spec: dict, store) -> str:
        answers = (getattr(store, "answers", None) or {}) if store is not None else {}
        area = getattr(store, "area_sqm", None) if store is not None else None
        business_type = derive_business_type(self.pack, answers) or "음식점"
        floor = floor_from_detail(getattr(store, "address_detail", None)) if store is not None else None
        text = spec["query"].format(business_type=business_type)
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
        if not spec or not self.has_data(spec["laws"]):
            return None
        try:
            with transaction() as session:
                hits = retriever.search(
                    session, query=self._query(spec, store), keywords=spec.get("keywords", []), names=spec["laws"],
                    embedder=self.embedder, pins=spec.get("pins"), top_k=spec.get("top_k", 6))
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
