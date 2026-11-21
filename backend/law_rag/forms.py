"""법령에 첨부된 공식 서식(별지 서식) 파일 링크를 법제처 API(licbyl)로 수집해 law_forms 에 저장한다.

- 서식 파일 자체는 저장하지 않는다. 법제처 원본 링크(HWP·PDF)와 공포일만 저장한다.
- 서식이 개정되면(공포일이 바뀌면) 새 행을 만들고 이전 행은 남긴다 (is_current=false). 그 서식을 쓰는 서류에는 재검토를 표시한다.
- 어떤 서식을 모을지는 규칙 묶음 documents 의 form { law_name, no, title } 이 정한다. 링크는 규칙 묶음에 적지 않는다.
"""

from __future__ import annotations

import logging
import re
import sys
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select

from db.models import DocumentRequirement, LawForm
from db.session import transaction
from law_rag.collector import LawCollector

logger = logging.getLogger(__name__)
KIND_FORM = "2"  # 법제처 별표서식 구분: 2 = 서식


@dataclass
class FormResult:
    law_name: str
    form_no: str
    change: str  # added | updated | unchanged | missing
    promulgated_on: date | None = None


def form_refs(pack: dict) -> list[dict]:
    """규칙 묶음에서 공식 서식 참조를 모은다 (중복 제거)."""
    docs = [d for v in (pack.get("documents") or {}).values() for d in v]
    docs += [d for r in pack.get("applicability_rules") or [] for d in r.get("documents") or []]
    seen, out = set(), []
    for d in docs:
        f = d.get("form")
        if f and (f["law_name"], f["form_no"]) not in seen:
            seen.add((f["law_name"], f["form_no"]))
            out.append(f)
    return out


def _date(value: str | None) -> date | None:
    m = re.fullmatch(r"(\d{4})(\d{2})(\d{2})", value or "")
    return date(int(m[1]), int(m[2]), int(m[3])) if m else None


def find_form(collector: LawCollector, ref: dict) -> dict | None:
    """법제처 서식 검색에서 법령명과 서식 번호가 정확히 같은 한 건. 같은 번호가 여럿이면 가장 최근 공포 건."""
    payload = collector._get("lawSearch.do", {"target": "licbyl", "query": ref["title"], "knd": KIND_FORM, "display": "100"})
    rows = (payload.get("licBylSearch") or {}).get("licbyl") or []
    rows = rows if isinstance(rows, list) else [rows]
    plain = lambda t: re.sub(r"<[^>]+>", "", t or "")  # noqa: E731 검색어 강조 태그 제거
    found = [r for r in rows if plain(r.get("관련법령명")) == ref["law_name"] and r.get("별표번호") == ref["form_no"]
             and r.get("별표종류") == "서식"]
    return max(found, key=lambda r: r.get("공포일자") or "") if found else None


def save_form(session, ref: dict, row: dict) -> FormResult:
    promulgated = _date(row.get("공포일자"))
    existing = session.scalar(select(LawForm).where(LawForm.law_name == ref["law_name"], LawForm.form_no == ref["form_no"],
                                                    LawForm.promulgated_on == promulgated))
    if existing is not None:
        existing.file_path, existing.pdf_path = row.get("별표서식파일링크"), row.get("별표서식PDF파일링크")
        return FormResult(ref["law_name"], ref["form_no"], "unchanged", promulgated)
    previous = list(session.scalars(select(LawForm).where(LawForm.law_name == ref["law_name"],
                                                          LawForm.form_no == ref["form_no"], LawForm.is_current.is_(True))))
    for old in previous:
        old.is_current = False
    session.add(LawForm(law_name=ref["law_name"], form_no=ref["form_no"], title=re.sub(r"<[^>]+>", "", row.get("별표명") or ref["title"]),
                        file_path=row.get("별표서식파일링크"), pdf_path=row.get("별표서식PDF파일링크"),
                        promulgated_on=promulgated, is_current=True))
    session.flush()  # 같은 트랜잭션에서 다시 조회해도 방금 넣은 행이 보이게 한다
    if previous:  # 개정: 이 서식을 쓰는 서류에 재검토를 표시한다
        flag_requirements(session, ref, promulgated)
    return FormResult(ref["law_name"], ref["form_no"], "updated" if previous else "added", promulgated)


def flag_requirements(session, ref: dict, promulgated: date | None) -> int:
    n = 0
    when = promulgated.isoformat() if promulgated else "날짜 확인 필요"
    for req in session.scalars(select(DocumentRequirement).where(DocumentRequirement.form.is_not(None))):
        if (req.form or {}).get("law_name") == ref["law_name"] and (req.form or {}).get("form_no") == ref["form_no"]:
            req.review_needed = True
            req.review_reason = f"공식 서식이 개정됐어요 (공포 {when}). 최신 서식으로 다시 작성하세요."
            n += 1
    return n


def collect_forms(collector: LawCollector, pack: dict) -> list[FormResult]:
    results = []
    for ref in form_refs(pack):
        try:
            row = find_form(collector, ref)
            if row is None:
                results.append(FormResult(ref["law_name"], ref["form_no"], "missing"))
                continue
            with transaction() as session:
                results.append(save_form(session, ref, row))
        except Exception as exc:  # 한 서식이 실패해도 나머지는 계속한다
            logger.warning("서식 수집 실패 %s %s: %s", ref["law_name"], ref["form_no"], exc)
            results.append(FormResult(ref["law_name"], ref["form_no"], "missing"))
    return results


def main() -> int:
    from dotenv import load_dotenv

    from rules.engine import load_pack

    load_dotenv()
    collector = LawCollector()
    try:
        results = collect_forms(collector, load_pack("cafe_restaurant"))
    finally:
        collector.close()
    for r in results:
        print(f"{r.law_name} 서식 {r.form_no}: {r.change}" + (f" (공포 {r.promulgated_on})" if r.promulgated_on else ""))
    return 1 if any(r.change == "missing" for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
