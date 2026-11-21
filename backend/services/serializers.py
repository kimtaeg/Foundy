"""DB 행 → API 응답. 리포트·체크리스트는 docs/report-schema.json·checklist-schema.json 형태를 따른다.

스키마가 모르는 필드는 거부되므로 허용된 키만 골라 내린다.
"""

from collections import defaultdict
from datetime import date
from typing import Any

from db.models import Alert, ChecklistItem, ReportItem, Store, User
from services.cards import current_verdict
from services.effective import effective_store
from services.links import link_map
from services.next_steps import VERDICT_ORDER, current_user_action, is_pending_decision, next_steps, recommended_label
from services.pack import contact_for, documents_for, hidden_categories, task_title
from services.timeutil import iso_kst, today_kst

STAGES = ("계약 전", "개업 전", "운영 중")
GROUP_LABELS = ("계약 전", "개업 4주 전", "개업 직전", "개업 후")
CATEGORIES = ("영업 인허가", "세무", "고용", "건물·시설", "간판·광고", "표시 의무", "정책")
REPORT_DISCLAIMER = "법률 자문이 아닌 사전 점검입니다. 중요한 결정 전에는 관할 기관에 확인하세요."
DOCUMENTS_DISCLAIMER = (
    "정부 서식은 해당 사이트에서만 효력이 있어요. 링크는 공식 사이트 첫 화면이고, "
    "찾는 방법은 각 서류 아래에 적어 뒀어요. 발급·제출은 직접 해야 해요."
)
EXAMPLE_NOTICE = "예시 데이터입니다. 실제 조회 결과가 아닙니다."

EVIDENCE_KEYS = ("type", "source", "value", "law_name", "article", "text", "url", "fetched_at", "from_cache", "from_mock")
OPTION_KEYS = ("option_id", "label", "summary", "time", "cost", "apply", "remedy", "user_action")
APPLY_KEYS = ("type", "payload", "needs_reanalyze", "adds_checklist")
ESTIMATE_KEYS = ("text", "basis", "delta_krw")
USER_ACTION_KEYS = ("type", "text", "est_minutes")
CONTACT_KEYS = ("agency", "phone", "is_example", "tip")


def _pick(d: dict | None, keys: tuple[str, ...]) -> dict | None:
    if d is None:
        return None
    return {k: d[k] for k in keys if k in d}


def evidence(items: list[dict] | None) -> list[dict]:
    return [_pick(e, EVIDENCE_KEYS) for e in items or [] if e.get("type") and e.get("source")]


def option(o: dict) -> dict:
    out = _pick(o, OPTION_KEYS)
    for k in ("time", "cost"):
        if k in out and out[k] is not None:
            out[k] = _pick(out[k], ESTIMATE_KEYS)
    out["apply"] = _pick(out.get("apply") or {"type": "none"}, APPLY_KEYS)
    if out.get("user_action") is not None:
        out["user_action"] = _pick(out["user_action"], USER_ACTION_KEYS)
    return out


def contact(c: dict | None) -> dict | None:
    return _pick(c, CONTACT_KEYS) if c else None


def dday(due: date | None, today: date | None = None) -> int | None:
    return None if due is None else (due - (today or today_kst())).days


# ---------- 계정·가게 ----------

def user(u: User) -> dict:
    return {"user_id": str(u.id), "name": u.name, "provider": u.provider, "username": u.username,
            "joined_at": u.joined_at.isoformat()}


def answers(src: Any) -> dict:
    get = (lambda k: src.get(k)) if isinstance(src, dict) else (lambda k: getattr(src, k))
    return {k: get(k) for k in ("sells_alcohol", "uses_terrace", "has_employees", "funds_krw")}


def store(pack: dict, s: Store, cards: list[ReportItem]) -> dict:
    """원본 값 + effective(선택 효과를 적용한 유효 값, DB 명세서 5-2)."""
    eff = effective_store(pack, s, cards)
    return {
        "store_id": str(s.id),
        "name": s.name,
        "business_type_input": s.business_type_input,
        "business_type": s.business_type,
        "address": s.address,
        "address_detail": s.address_detail,
        "address_codes": s.address_codes,
        "opening_date": s.opening_date.isoformat(),
        "answers": answers(s),
        "owner_birth_year": s.owner_birth_year,
        "region": s.region,
        "is_demo": s.is_demo,
        "effective": {"name": eff["name"], "business_type": eff["business_type"], "answers": answers(eff)},
    }


# ---------- 점검 리포트 ----------

def report_item(pack: dict, card: ReportItem, linked: list[str], sigungu: str | None = None) -> dict:
    out = {
        "item_id": card.item_key,
        "check_id": card.check_id,
        "stage": card.stage,
        "title": card.title,
        "verdict": current_verdict(card),
        "decided_by": card.decided_by,
        "reason": card.reason or "",
        "options": [option(o) for o in card.options or []],
        "recommendation": card.recommendation,
        "contact": contact(contact_for(pack, card.contact_key, sigungu)),
        "user_action": _pick(current_user_action(card), USER_ACTION_KEYS),
        "chosen_option": card.chosen_option,
        "action_status": card.action_status,
        "action_reply": card.action_reply,
        "resolved_title": card.resolved_title,
        "verdict_before": card.verdict_before,
        "linked_task_ids": linked,
        "applied_changes": list(card.applied_changes or []),
        "evidence": evidence(card.evidence),
    }
    if card.consequence:
        out["consequence"] = card.consequence
    return out


def _sort_key(card: ReportItem) -> tuple:
    # 후속 행동을 마치기 전에는 원래 판정 자리에 둔다
    verdict = current_verdict(card) if card.action_status == "done" else card.verdict
    return (VERDICT_ORDER.get(verdict, 9), card.item_key)


def summary(cards: list[ReportItem]) -> dict:
    counts = {"high": 0, "low": 0, "unknown": 0, "ok": 0}
    for c in cards:
        counts[current_verdict(c)] += 1
    return counts


def report(pack: dict, s: Store, cards: list[ReportItem], items: list[ChecklistItem], run: Any, stage: str | None) -> dict:
    links = link_map(pack, cards, items)
    linked_by_card: dict[str, list[str]] = defaultdict(list)
    for item_key, card_keys in links.items():
        for ck in card_keys:
            linked_by_card[ck].append(item_key)
    groups = []
    for st in STAGES:
        if stage and st != stage:
            continue
        rows = sorted((c for c in cards if c.stage == st), key=_sort_key)
        groups.append({"stage": st, "items": [report_item(pack, c, sorted(linked_by_card[c.item_key]),
                                                          (s.address_codes or {}).get("sigungu_cd")) for c in rows]})
    out = {
        "store_id": str(s.id),
        "run_id": str(run.id) if run else "",
        "generated_at": iso_kst(run.finished_at if run and run.finished_at else s.onboarded_at or s.created_at),
        "summary": summary(cards),
        "groups": groups,
        "disclaimer": REPORT_DISCLAIMER,
    }
    if s.is_demo:
        out["is_example"] = True
        out["example_notice"] = EXAMPLE_NOTICE
    return out


# ---------- 체크리스트·서류 ----------

def checklist_item(pack: dict, item: ChecklistItem, eff: dict, links: dict[str, list[str]], today: date,
                   sigungu: str | None = None) -> dict:
    return {
        "item_id": item.item_key,
        "task": task_title(pack, item.task, eff, item.rule_key),
        "category": item.category,
        "group_label": item.group_label,
        "dday": dday(item.due_date, today),
        "due_date": item.due_date.isoformat(),
        "documents": documents_for(pack, item.rule_key, sigungu),
        "agency": item.agency,
        "contact": contact(contact_for(pack, item.contact_key, sigungu)),
        "source": item.source,
        "report_item_ids": links.get(item.item_key, []),
        "evidence": evidence(item.evidence),
        "done": item.done,
        "auto_checked": item.auto_checked,
    }


def checklist(pack: dict, s: Store, cards: list[ReportItem], items: list[ChecklistItem], view: str) -> dict:
    eff = effective_store(pack, s, cards)
    hidden = hidden_categories(pack, eff)
    hidden_set = {h["category"] for h in hidden}
    links = link_map(pack, cards, items)
    today = today_kst()
    visible = sorted((i for i in items if i.category not in hidden_set), key=lambda i: (i.due_date, i.item_key))
    rows = [(i, checklist_item(pack, i, eff, links, today, (s.address_codes or {}).get("sigungu_cd"))) for i in visible]
    if view == "category":
        groups = [{"category": c, "items": [r for i, r in rows if i.category == c]} for c in CATEGORIES]
    else:
        groups = [{"group_label": g, "items": [r for i, r in rows if i.group_label == g]} for g in GROUP_LABELS]
    out = {
        "opening_date": s.opening_date.isoformat(),
        "progress": {"done": sum(1 for i in visible if i.done), "total": len(visible)},
        "groups": [g for g in groups if g["items"]],
        "hidden_categories": hidden,
    }
    if s.is_demo:
        out["is_example"] = True
        out["example_notice"] = EXAMPLE_NOTICE
    return out


def documents(pack: dict, s: Store, cards: list[ReportItem], items: list[ChecklistItem]) -> dict:
    eff = effective_store(pack, s, cards)
    hidden_set = {h["category"] for h in hidden_categories(pack, eff)}
    today = today_kst()
    groups, total, finished = [], 0, 0
    for i in sorted(items, key=lambda i: (i.due_date, i.item_key)):
        docs = documents_for(pack, i.rule_key, (s.address_codes or {}).get("sigungu_cd"))
        if i.category in hidden_set or not docs:
            continue
        total += len(docs)
        finished += len(docs) if i.done else 0
        groups.append({"item_id": i.item_key, "task": task_title(pack, i.task, eff, i.rule_key), "group_label": i.group_label,
                       "due_date": i.due_date.isoformat(), "dday": dday(i.due_date, today), "agency": i.agency,
                       "done": i.done, "documents": docs})
    return {"summary": {"total": total, "finished": finished, "remaining": total - finished},
            "groups": groups, "disclaimer": DOCUMENTS_DISCLAIMER}


def documents_progress(pack: dict, items: list[ChecklistItem], hidden_set: set[str]) -> dict:
    total = finished = 0
    for i in items:
        if i.category in hidden_set:
            continue
        n = len(documents_for(pack, i.rule_key))
        total += n
        finished += n if i.done else 0
    return {"finished": finished, "total": total}


# ---------- 알림 ----------

def alert(a: Alert) -> dict:
    return {"alert_id": str(a.id), "type": a.type, "title": a.title, "body": a.body, "cta": a.cta, "diff": a.diff,
            "is_example": a.is_example, "read": a.read, "created_at": iso_kst(a.created_at)}


# ---------- 대시보드 ----------

def dashboard(pack: dict, s: Store, cards: list[ReportItem], items: list[ChecklistItem], alerts: list[Alert], run: Any) -> dict:
    eff = effective_store(pack, s, cards)
    hidden_set = {h["category"] for h in hidden_categories(pack, eff)}
    visible = [i for i in items if i.category not in hidden_set]
    links = link_map(pack, cards, items)
    today = today_kst()

    pending = sorted((c for c in cards if is_pending_decision(c)), key=lambda c: (VERDICT_ORDER.get(c.verdict, 9), c.item_key))
    todos = []
    for c in sorted(cards, key=lambda c: (VERDICT_ORDER.get(current_verdict(c), 9), c.item_key)):
        action = current_user_action(c)
        if is_pending_decision(c) or c.action_status == "done" or not action:
            continue
        linked = sorted((i for i in visible if c.item_key in links.get(i.item_key, [])), key=lambda i: i.due_date)
        first = linked[0] if linked else None
        todos.append({"item_id": c.item_key, "task": action["text"],
                      "due_date": first.due_date.isoformat() if first else None,
                      "category": first.category if first else None, "est_minutes": action.get("est_minutes")})

    sorted_alerts = sorted(alerts, key=lambda a: a.created_at, reverse=True)
    demo_or_ready = "example" if s.is_demo else "ready"
    return {
        "store": {"store_id": str(s.id), "name": eff["name"], "business_type": eff["business_type"],
                  "opening_date": s.opening_date.isoformat(), "d_day": (today - s.opening_date).days},
        "last_run": {"run_id": str(run.id), "finished_at": iso_kst(run.finished_at)} if run else None,
        "report_summary": summary(cards),
        "pending_decisions": [{"item_id": c.item_key, "title": c.title, "verdict": current_verdict(c),
                               "recommended_option": recommended_label(c)} for c in pending],
        "today_todos": todos,
        "next_steps": next_steps(cards, items, hidden=hidden_set),
        "checklist_progress": {"done": sum(1 for i in visible if i.done), "total": len(visible)},
        "documents_progress": documents_progress(pack, items, hidden_set),
        "alerts": {"unread": sum(1 for a in alerts if not a.read),
                   "latest": [{"title": a.title, "type": a.type, "is_example": a.is_example} for a in sorted_alerts[:3]]},
        "menus": {"report": demo_or_ready, "checklist": demo_or_ready, "documents": demo_or_ready,
                  "chat": "unavailable", "grants": "unavailable"},
    }
