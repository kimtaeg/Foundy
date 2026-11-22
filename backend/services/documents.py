"""서류함: 체크리스트와 독립된 서류 요구사항·상태 관리 (코드가 한다. AI 아님).

서류는 세 곳에서 만들어진다. 어느 쪽이든 같은 document_requirements 로 들어와 같은 방식으로 관리한다.
- template: 규칙 묶음 documents (체크리스트 항목에 붙은 기본 서류)
- rule_engine: 법령 규칙(applicability_rules[].documents)이 적용·확인 필요로 판정됐을 때
- legal_analysis: 위와 같지만 점검 카드가 검증해 인용한 조문이 근거로 붙은 경우
법령에 의무가 있어도 별도 서류가 없으면 서류를 만들지 않는다 (체크리스트 작업으로만 둔다).

진행률은 체크리스트 완료가 아니라 서류 자신의 상태로 센다. '해당 없음'은 분모에서 뺀다.
발급·취득 완료(obtained)와 제출 완료(submitted)는 다른 상태다.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select, tuple_
from sqlalchemy.orm import Session

from db.models import DocumentHistory, DocumentRequirement, LawForm, LegalObligation, Store
from rules.applicability import APPLIES, NEEDS_CHECK
from services.effective import effective_store
from services.pack import hidden_categories, task_title
from services.timeutil import iso_kst, now_utc

DOC_TYPES = {
    "issued": "발급 서류", "application": "작성·제출 서류", "certificate": "교육·검사로 취득하는 서류",
    "kept": "보관 서류", "reference": "확인 자료",
}
STATUSES = {
    "not_started": "준비 전", "in_progress": "준비 중", "obtained": "발급·취득 완료", "submitted": "제출 완료",
    "needs_fix": "보완 필요", "not_applicable": "해당 없음",
}
DONE = {"obtained", "submitted"}
LAW_WEB = "https://www.law.go.kr"
STALE_PREFIX = "이 서류는 더 이상 필요하지 않을 수 있어요"
STALE_REASON = f"{STALE_PREFIX}. 진행한 기록은 남겨 둘게요."


class DocumentError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


# ---------------------------------------------------------------- 요구사항 만들기

def _spec(d: dict, *, source_type: str, applicability: str, rule_id: str | None, reason: str | None,
          law_basis: dict | None) -> dict:
    return {
        "doc_key": d["id"], "name": d["name"], "document_type": d.get("type", "reference"),
        "agency": d.get("agency") or None, "guide": d.get("guide") or None, "site_keys": list(d.get("sites") or []),
        "form": d.get("form"), "applicability_status": applicability,
        "source_type": source_type, "rule_id": rule_id, "reason": reason, "law_basis": law_basis, "task_keys": [],
    }


def desired_requirements(pack: dict, items: list[Any], obligations: list[Any], eff: dict,
                         hidden: set[str]) -> dict[str, dict]:
    """지금 가게에 필요한 서류 {doc_key: 명세}. 규칙 묶음·규칙 엔진 판정·체크리스트 항목만 입력으로 쓴다."""
    out: dict[str, dict] = {}
    visible = [i for i in items if i.category not in hidden]

    for item in visible:  # 1) 기본 서류 템플릿: 체크리스트 항목에 붙은 서류
        for d in (pack.get("documents") or {}).get(item.rule_key or "", []):
            law = item.law_basis if getattr(item, "task_type", "preparation") != "preparation" else None
            spec = out.setdefault(d["id"], _spec(
                d, source_type="template", applicability=d.get("applicability", "applies"),
                rule_id=getattr(item, "obligation_rule_id", None), reason=getattr(item, "reason", None) if law else None,
                law_basis=law))
            if item.item_key not in spec["task_keys"]:
                spec["task_keys"].append(item.item_key)

    rules = {r["rule_id"]: r for r in pack.get("applicability_rules") or []}
    for ob in obligations:  # 2) 법령 규칙이 만든 서류
        rule = rules.get(ob.rule_id) or {}
        if ob.status not in (APPLIES, NEEDS_CHECK) or not rule.get("documents"):
            continue
        linked = [i for i in visible if getattr(i, "obligation_rule_id", None) == ob.rule_id]
        url = next((i.law_basis.get("url") for i in linked if i.law_basis and i.law_basis.get("url")), None)
        law = {"law_name": ob.law_name, "article": ob.article_label, "url": url}
        for d in rule["documents"]:
            applicability = ob.status
            if d.get("when"):
                value = eff.get(d["when"])
                if value is False:
                    continue  # 이 가게에는 해당하지 않는 서류
                if value is None:
                    applicability = NEEDS_CHECK
            if d.get("applicability"):
                applicability = d["applicability"]
            reason = ob.reason if applicability == APPLIES else f"{ob.title}: 해당 여부를 확인해야 해요."
            spec = out.setdefault(d["id"], _spec(
                d, source_type="legal_analysis" if url else "rule_engine", applicability=applicability,
                rule_id=ob.rule_id, reason=reason, law_basis=law))
            for i in linked:
                if i.item_key not in spec["task_keys"]:
                    spec["task_keys"].append(i.item_key)
    return out


def sync_requirements(session: Session, pack: dict, store: Any, cards: list[Any], items: list[Any]) -> list[DocumentRequirement]:
    """가게의 서류 요구사항을 지금 상태에 맞춘다 (멱등). 서류의 상태·메모는 건드리지 않는다.

    더는 필요 없어진 서류는, 손대지 않았으면 지우고 사용자가 진행했으면 남기고 재검토를 표시한다.
    """
    # 같은 가게에 동시에 들어온 요청이 같은 서류를 두 번 만들지 않게 가게 행을 잠그고 시작한다 (트랜잭션이 끝나면 풀린다)
    session.execute(select(Store.id).where(Store.id == store.id).with_for_update())
    obligations = list(session.scalars(select(LegalObligation).where(LegalObligation.store_id == store.id)))
    rows = list(session.scalars(select(DocumentRequirement).where(DocumentRequirement.store_id == store.id)))
    changed, obsolete = requirement_changes(pack, store, cards, items, obligations, rows)
    return apply_requirement_changes(session, store, rows, changed, obsolete)


def requirement_changes(pack: dict, store: Any, cards: list[Any], items: list[Any], obligations: list[Any],
                        rows: list[DocumentRequirement]) -> tuple[list[tuple[DocumentRequirement | None, dict]],
                                                                   list[DocumentRequirement]]:
    eff = effective_store(pack, store, cards)
    hidden = {h["category"] for h in hidden_categories(pack, eff)}
    desired = desired_requirements(pack, items, obligations, eff, hidden)
    by_key = {r.doc_key: r for r in rows}
    changed = []
    for key, spec in desired.items():
        row = by_key.pop(key, None)
        if (row is None or _stale_review(row) or
                any(getattr(row, field) != value for field, value in spec.items())):
            changed.append((row, spec))
    obsolete = [row for row in by_key.values() if _deletable(row) or not row.review_needed or row.review_reason != STALE_REASON]
    return changed, obsolete


def _stale_review(row: DocumentRequirement) -> bool:
    return bool(row.review_needed and (row.review_reason or "").startswith(STALE_PREFIX))


def _deletable(row: DocumentRequirement) -> bool:
    return row.status in ("not_started", "not_applicable")


def apply_requirement_changes(session: Session, store: Any, rows: list[DocumentRequirement],
                              changed: list[tuple[DocumentRequirement | None, dict]],
                              obsolete: list[DocumentRequirement]) -> list[DocumentRequirement]:
    now = now_utc()
    for row, spec in changed:
        if row is None:
            row = DocumentRequirement(store_id=store.id, status="not_started", review_needed=False)
            session.add(row)
            rows.append(row)
        for field, value in spec.items():
            setattr(row, field, value)
        if _stale_review(row):
            row.review_needed, row.review_reason = False, None  # 다시 필요해졌다
        row.updated_at = now

    for row in obsolete:
        if _deletable(row):
            session.delete(row)
            rows.remove(row)
        else:
            row.review_needed, row.review_reason = True, STALE_REASON
    session.flush()
    return rows


# ---------------------------------------------------------------- 상태

def read_requirements(session: Session, store: Any) -> list[DocumentRequirement] | None:
    """저장된 서류 요구사항만 읽는다 (동기화하지 않는다). 아직 하나도 없으면 None."""
    rows = list(session.scalars(select(DocumentRequirement).where(DocumentRequirement.store_id == store.id)))
    return rows or None


def _history(session: Session, row: DocumentRequirement, before: str | None, after: str, note: str | None) -> None:
    session.add(DocumentHistory(requirement_id=row.id, from_status=before, to_status=after, note=note))


def set_status(session: Session, row: DocumentRequirement, status: str, note: str | None = None) -> bool:
    """서류 상태를 바꾼다. 바뀌었으면 True. 발급·취득 완료와 제출 완료는 따로 기록한다."""
    if status not in STATUSES:
        raise DocumentError("INVALID_STATUS", f"알 수 없는 상태입니다: {status}")
    changed = status != row.status
    if not changed and note is None:
        return False
    before = row.status
    row.status, row.status_updated_at, row.updated_at = status, now_utc(), now_utc()
    if note is not None:
        row.note = note.strip()[:500] or None
    if changed:
        _history(session, row, before, status, note)
        if status in DONE or status == "not_applicable":
            row.review_needed, row.review_reason = False, None  # 사용자가 확인하고 처리했다
    return changed


# ---------------------------------------------------------------- 응답 만들기

def _current_forms(session: Session, keys: set[tuple[str, str]]) -> dict[tuple[str, str], LawForm]:
    if not keys:
        return {}
    rows = session.scalars(select(LawForm).where(tuple_(LawForm.law_name, LawForm.form_no).in_(keys),
                                                LawForm.is_current.is_(True))
                           .order_by(LawForm.promulgated_on.desc()))
    latest = {}
    for row in rows:
        latest.setdefault((row.law_name, row.form_no), row)
    return latest


def _form_view(form: dict | None, forms: dict[tuple[str, str], LawForm]) -> dict | None:
    if not form:
        return None
    row = forms.get((form["law_name"], form["form_no"]))
    view = {"law_name": form["law_name"], "form_no": form["form_no"], "title": form.get("title"), "pdf_url": None,
            "file_url": None, "revision_date": None}
    if row is not None:
        view.update(title=row.title, pdf_url=LAW_WEB + row.pdf_path if row.pdf_path else None,
                    file_url=LAW_WEB + row.file_path if row.file_path else None,
                    revision_date=row.promulgated_on.isoformat() if row.promulgated_on else None)
    return view


def _links(pack: dict, site_keys: list[str]) -> list[dict]:
    sites = pack.get("sites") or {}
    return [{"label": sites[k]["label"], "url": sites[k]["url"]} for k in site_keys if k in sites]


def requirement_view(session: Session, pack: dict, row: DocumentRequirement, items_by_key: dict[str, Any],
                     today: date, with_history: bool = False,
                     forms: dict[tuple[str, str], LawForm] | None = None) -> dict:
    tasks = [items_by_key[k] for k in row.task_keys or [] if k in items_by_key]
    dues = sorted(t.due_date for t in tasks if t.due_date)
    statutory = sorted(t.statutory_deadline for t in tasks if getattr(t, "statutory_deadline", None))
    if forms is None:
        forms = _current_forms(session, {(row.form["law_name"], row.form["form_no"])} if row.form else set())
    out = {
        **requirement_status(row), "name": row.name,
        "type": row.document_type, "type_label": DOC_TYPES.get(row.document_type, row.document_type),
        "applicability": row.applicability_status, "source_type": row.source_type,
        "added_by_ai": row.source_type in ("rule_engine", "legal_analysis"),
        "reason": row.reason, "law_basis": row.law_basis, "agency": row.agency or "", "guide": row.guide or "",
        "links": _links(pack, row.site_keys or []),
        "form": _form_view(row.form, forms),
        "tasks": [{"item_id": t.item_key, "task": t.task, "done": t.done, "category": t.category,
                   "group_label": t.group_label} for t in tasks],
        "due_date": dues[0].isoformat() if dues else None,
        "dday": (dues[0] - today).days if dues else None,
        "statutory_deadline": statutory[0].isoformat() if statutory else None,
    }
    if with_history:
        hist = session.scalars(select(DocumentHistory).where(DocumentHistory.requirement_id == row.id)
                               .order_by(DocumentHistory.created_at.desc()).limit(50))
        out["history"] = [{"from": h.from_status, "to": h.to_status, "note": h.note, "at": iso_kst(h.created_at)}
                          for h in hist]
    return out


def requirement_status(row: DocumentRequirement) -> dict:
    return {
        "doc_id": row.doc_key, "doc_key": row.doc_key, "status": row.status, "status_label": STATUSES[row.status],
        "note": row.note, "status_updated_at": iso_kst(row.status_updated_at) if row.status_updated_at else None,
        "review_needed": row.review_needed, "review_reason": row.review_reason,
    }


def progress(rows: list[DocumentRequirement]) -> dict:
    """서류 진행률: 서류 자신의 상태로 센다. 해당 없음은 분모에서 뺀다."""
    counted = [r for r in rows if r.status != "not_applicable" and r.applicability_status != "not_applicable"]
    finished = sum(1 for r in counted if r.status in DONE)
    return {"finished": finished, "total": len(counted)}


def documents_response(session: Session, pack: dict, store: Any, cards: list[Any],
                       rows: list[DocumentRequirement], items: list[Any],
                       today: date, disclaimer: str) -> dict:
    """GET /documents. groups 는 예전 모양(체크리스트 항목별)을 유지하고, 서류별 상태는 requirements·sections 로 준다."""
    by_key = {i.item_key: i for i in items}
    forms = _current_forms(session, {(r.form["law_name"], r.form["form_no"]) for r in rows if r.form})
    views = {r.doc_key: requirement_view(session, pack, r, by_key, today, forms=forms) for r in rows}
    ordered = sorted(views.values(), key=lambda v: (v["due_date"] or "9999", v["name"]))
    eff = effective_store(pack, store, cards)
    hidden = {entry["category"] for entry in hidden_categories(pack, eff)}

    groups = []
    for item in sorted((i for i in items if i.category not in hidden), key=lambda i: (i.due_date, i.item_key)):
        docs = [v for v in ordered if item.item_key in [t["item_id"] for t in v["tasks"]]]
        if docs:
            groups.append({"item_id": item.item_key, "task": task_title(pack, item.task, eff, item.rule_key),
                           "group_label": item.group_label, "category": item.category,
                           "due_date": item.due_date.isoformat(), "dday": (item.due_date - today).days,
                           "agency": item.agency, "done": item.done, "documents": docs})
    prog = progress(rows)
    counted = [r for r in rows if r.status != "not_applicable" and r.applicability_status != "not_applicable"]
    by_status = {s: sum(1 for r in rows if r.status == s) for s in STATUSES}
    summary = {
        "total": prog["total"], "finished": prog["finished"], "remaining": prog["total"] - prog["finished"],
        "not_applicable": len(rows) - len(counted), "by_status": by_status,
        "by_type": {t: sum(1 for r in counted if r.document_type == t) for t in DOC_TYPES},
        "to_obtain": sum(1 for r in counted if r.document_type in ("issued", "certificate")),
        "to_write_or_keep": sum(1 for r in counted if r.document_type in ("application", "kept")),
        "review_needed": sum(1 for r in rows if r.review_needed),
    }
    return {"summary": summary, "groups": groups, "requirements": ordered, "disclaimer": disclaimer}
