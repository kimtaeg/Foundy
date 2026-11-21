"""법령 변경 감지: 최신 법령을 다시 받아 저장본과 비교하고, 바뀐 조문과 영향받는 규칙·가게를 기록하고 알린다.

법령이 개정됐다고 모든 가게에 영향이 있는 것은 아니다. 바뀐 조문이 걸린 적용 규칙(applicability_rules)과
그 규칙이 적용·확인 필요로 판정된 가게(legal_obligations)만 골라서 알린다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy import select

from db.models import Alert, ApplicabilityRule, LawChangeLog, LegalObligation
from db.session import transaction
from law_rag.parser import ParsedLaw
from law_rag.store import IngestResult, save_law

logger = logging.getLogger(__name__)


@dataclass
class RefreshReport:
    results: list[IngestResult] = field(default_factory=list)
    failed: list[tuple[str, str]] = field(default_factory=list)  # (법령명, 사유)
    alerts_created: int = 0

    @property
    def changed(self) -> list[IngestResult]:
        return [r for r in self.results if r.change == "updated"]


def _affected(session, law_name: str, changed_labels: set[str]) -> tuple[list[str], list]:
    """바뀐 조문이 걸린 규칙과, 그 규칙이 적용·확인 필요인 가게들."""
    rules = [r for r in session.scalars(select(ApplicabilityRule).where(ApplicabilityRule.law_name == law_name))
             if r.article_label is None or r.article_label in changed_labels]
    rule_ids = [r.rule_id for r in rules]
    obligations = []
    if rule_ids:
        obligations = list(session.scalars(select(LegalObligation).where(
            LegalObligation.rule_id.in_(rule_ids), LegalObligation.status.in_(("applies", "needs_check")))))
    return rule_ids, obligations


def record_change(session, result: IngestResult) -> int:
    """변경 기록을 남기고 영향받는 가게에 알림을 만든다. 만든 알림 수를 돌려준다."""
    labels = {c["label"] for c in result.changed_articles}
    rule_ids, obligations = _affected(session, result.law_name, labels)
    store_ids = {o.store_id for o in obligations}
    session.add(LawChangeLog(
        law_key=result.law_key, law_name=result.law_name, change_type=result.change, old_mst=result.old_mst,
        new_mst=result.new_mst or "", old_effective=result.old_effective, new_effective=result.new_effective,
        changed_articles=result.changed_articles, affected_rules=rule_ids, affected_stores=len(store_ids)))
    if result.change != "updated":
        return 0

    created = 0
    by_store: dict = {}
    for ob in obligations:
        by_store.setdefault(ob.store_id, []).append(ob)
    effective = result.new_effective.isoformat() if result.new_effective else "시행일 확인 필요"
    for store_id, items in by_store.items():
        key = f"law-{result.law_key}-{result.new_mst}"
        if session.scalar(select(Alert.id).where(Alert.store_id == store_id, Alert.dedupe_key == key)):
            continue
        articles = ", ".join(sorted({o.article_label for o in items if o.article_label}))
        titles = " · ".join(o.title for o in items[:3])
        session.add(Alert(
            store_id=store_id, dedupe_key=key, type="change",
            title=f"{result.law_name}이(가) 개정돼 확인이 필요해요",
            body=f"{titles}에 관련된 {articles or '조문'}이(가) 바뀌었어요. 시행일 {effective}. 개정 내용이 내 가게에 영향을 주는지 확인해 보세요.",
            cta={"page": "report", "label": "점검 리포트 열기"},
            diff={"law": result.law_name, "changed": result.changed_articles[:20], "effective": effective}))
        created += 1
    return created


def apply_parsed(parsed: ParsedLaw, embedder=None, embed: bool = True) -> tuple[IngestResult, int]:
    """파싱한 법령 한 건을 저장하고 변경이 있으면 기록·알림까지 처리한다."""
    with transaction() as session:
        result = save_law(session, parsed, embedder=embedder, embed=embed)
        alerts = record_change(session, result) if result.change != "unchanged" else 0
    return result, alerts


def refresh(collector, names: list[str], embedder=None) -> RefreshReport:
    """법제처에서 names 의 현행 법령을 받아 저장한다. 한 법령이 실패해도 나머지는 계속한다."""
    report = RefreshReport()
    for name in names:
        try:
            parsed = collector.fetch(name)
            result, alerts = apply_parsed(parsed, embedder)
        except Exception as exc:
            logger.warning("%s 갱신 실패: %s", name, exc)
            report.failed.append((name, str(exc)[:200]))
            continue
        report.results.append(result)
        report.alerts_created += alerts
    return report
