"""분석 실행·이벤트·결과 저장. 외부 호출과 결과 저장 트랜잭션은 분리한다."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import json
import logging
import threading
import time
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from agent.cost import CostTracker
from agent.loop import run_analysis
from agent.ports import StoreInput
from api.errors import ApiError, invalid_input
from calc.dates import Dates
from config import get_settings
from db.models import Alert, ChecklistItem, CostLog, ReportItem, Run, Store
from db.session import transaction
from services.cards import current_verdict, decision_alert, is_pending_decision, load_state
from services.effective import effective_store
from services.links import sync_links
from services.pack import get_pack
from services.timeutil import iso_kst, now_utc

logger = logging.getLogger(__name__)
ACTIVE = {"queued", "running"}
CORE_SCOPE = ("building", "law", "trademark", "checklist")


class RunStopped(Exception):
    pass


def normalize_scope(scope: list[str] | None) -> list[str]:
    if scope is None:
        return list(CORE_SCOPE)
    if not scope or any(s not in (*CORE_SCOPE, "grants") for s in scope):
        raise invalid_input("분석 범위가 올바르지 않습니다.")
    selected = [s for s in CORE_SCOPE if s in scope]
    if not selected:
        raise invalid_input("지원사업 단독 분석은 아직 지원하지 않습니다.")
    return selected


def store_input(store: Store, cards: list[ReportItem]) -> StoreInput:
    eff = effective_store(get_pack(store), store, cards)
    return StoreInput(store_id=str(store.id), name=eff["name"], business_type_input=store.business_type_input,
                      address=store.address, address_detail=store.address_detail,
                      address_codes=store.address_codes or {}, opening_date=store.opening_date,
                      owner_birth_year=store.owner_birth_year,
                      answers={k: eff[k] for k in ("sells_alcohol", "uses_terrace", "has_employees", "funds_krw")})


def _fingerprint(value: StoreInput) -> str:
    return json.dumps(value.model_dump(mode="json"), sort_keys=True, ensure_ascii=False)


def _event(event: str, data: dict) -> dict:
    return {"event": event, "data": data, "at": iso_kst(now_utc())}


def _fail(row: Run, code: str, message: str) -> None:
    row.status, row.error, row.finished_at = "failed", message, now_utc()
    row.events = [*(row.events or []), _event("error", {"code": code, "message": message})]


def expire_stale(session, store_id=None) -> int:
    deadline = now_utc() - timedelta(seconds=get_settings().analysis_timeout_seconds)
    query = select(Run).where(Run.status.in_(ACTIVE))
    if store_id is not None:
        query = query.where(Run.store_id == store_id)
    rows = session.scalars(query.with_for_update())
    count = 0
    for row in rows:
        if (row.started_at or row.created_at) < deadline:
            _fail(row, "ANALYSIS_TIMEOUT", "분석 제한 시간을 초과했습니다.")
            count += 1
    session.flush()
    return count


def create_run(session, store: Store, manager: "AnalysisManager", scope: list[str]):
    store = session.scalar(select(Store).where(Store.id == store.id).with_for_update()
                           .execution_options(populate_existing=True))
    expire_stale(session, store.id)
    active = session.scalar(select(Run.id).where(Run.store_id == store.id, Run.status.in_(ACTIVE)))
    if active:
        raise ApiError(409, "RUN_IN_PROGRESS", "이미 분석이 실행 중입니다.")
    cards, _ = load_state(session, store)
    snapshot = store_input(store, cards)
    if snapshot.answers["sells_alcohol"] is None:
        raise invalid_input("주류 판매 여부를 먼저 답변해 주세요.")
    if not manager.reserve():
        raise ApiError(503, "ANALYSIS_BUSY", "분석 요청이 많습니다. 잠시 후 다시 시도해 주세요.")
    try:
        row = Run(store_id=store.id, trigger="user", scope=scope, status="queued", events=[])
        session.add(row)
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        manager.release()
        if getattr(getattr(exc.orig, "diag", None), "constraint_name", None) == "runs_one_active":
            raise ApiError(409, "RUN_IN_PROGRESS", "이미 분석이 실행 중입니다.") from exc
        raise
    except Exception:
        session.rollback()
        manager.release()
        raise
    try:
        manager.submit(row.id, snapshot, scope)
    except Exception:
        manager.release()
        fail_run(row.id, "ANALYSIS_FAILED", "분석 작업을 시작하지 못했습니다.")
        raise
    return row.id


def append_event(run_id: uuid.UUID, event: str, data: dict) -> None:
    if event == "done":
        return  # 분석 함수의 완료는 DB 저장이 끝난 뒤에만 공개한다.
    if event not in {"step", "item", "error"}:
        raise ValueError("Unsupported analysis event")
    with transaction() as session:
        row = session.scalar(select(Run).where(Run.id == run_id).with_for_update())
        if row is None or row.status not in ACTIVE:
            raise RunStopped()
        row.events = [*(row.events or []), _event(event, data)]


def fail_run(run_id: uuid.UUID, code: str, message: str) -> None:
    with transaction() as session:
        row = session.scalar(select(Run).where(Run.id == run_id).with_for_update())
        if row is not None and row.status in ACTIVE:
            _fail(row, code, message)


def save_failed_costs(run_id, cost):
    if not cost.rows:
        return
    with transaction() as session:
        row = session.scalar(select(Run).where(Run.id == run_id).with_for_update())
        if row is None or row.status != "failed" or session.scalar(select(CostLog.id).where(CostLog.run_id == run_id).limit(1)):
            return
        for c in cost.rows:
            session.add(CostLog(run_id=row.id, store_id=row.store_id, step=c.step, model=c.model,
                                input_tokens=c.input_tokens, output_tokens=c.output_tokens, cost_krw=c.cost_krw))


def persist_result(run_id, snapshot, result, cost, scope, deadline=None):
    with transaction() as session:
        initial = session.get(Run, run_id)
        if initial is None:
            raise RunStopped()
        store = session.scalar(select(Store).where(Store.id == initial.store_id).with_for_update())
        row = session.scalar(select(Run).where(Run.id == run_id).with_for_update()
                             .execution_options(populate_existing=True))
        if row.status not in ACTIVE:
            raise RunStopped()
        cards = list(session.scalars(select(ReportItem).where(ReportItem.store_id == store.id).with_for_update()))
        tasks = list(session.scalars(select(ChecklistItem).where(ChecklistItem.store_id == store.id).with_for_update()))
        if _fingerprint(store_input(store, cards)) != _fingerprint(snapshot):
            raise ValueError("INPUT_CHANGED")
        pack = get_pack(store)
        by_check = {c.check_id: c for c in cards}
        for item in result.items:
            card = by_check.get(item.check_id)
            if card is not None and card.item_key != item.item_id:
                raise ValueError("LEGACY_REPORT_IDS")
            if card is None:
                card = ReportItem(store_id=store.id, item_key=item.item_id, check_id=item.check_id,
                                  action_status="pending", applied_effects={}, applied_changes=[])
                session.add(card)
                cards.append(card)
            card.run_id = row.id
            for key in ("stage", "verdict", "decided_by", "title", "reason", "consequence"):
                setattr(card, key, getattr(item, key))
            # 이미 선택한 대응의 효과·완료·메모를 분석 결과로 덮어쓰지 않는다.
            if not card.chosen_option:
                card.options = [o.model_dump(mode="json") for o in item.options]
                card.recommendation = item.recommendation.model_dump(mode="json") if item.recommendation else None
                card.user_action = item.user_action.model_dump(mode="json") if item.user_action else None
            card.evidence = [e.model_dump(mode="json") for e in item.evidence]
            spec = next(c for c in pack["checks"] if c["id"] == item.check_id)
            card.contact_key = spec.get("contact")
        if "checklist" in scope:
            by_key = {t.item_key: t for t in tasks}
            for item in result.checklist:
                task = by_key.get(item.item_id)
                if task is not None and task.source != item.source:
                    raise ValueError("LEGACY_CHECKLIST_IDS")
                if task is not None and not task.rule_key and task.task != item.task:
                    raise ValueError("LEGACY_CHECKLIST_IDS")
                if task is None:
                    task = ChecklistItem(store_id=store.id, item_key=item.item_id, source=item.source,
                                         done=False, auto_checked=False)
                    session.add(task)
                    tasks.append(task)
                spec = next(t for t in pack["checklist"] if t["id"] == item.item_id)
                task.rule_key, task.contact_key = item.rule_key, spec.get("contact")
                for key in ("task", "category", "group_label", "due_date", "agency"):
                    setattr(task, key, getattr(item, key))
                task.offset_days = (item.due_date - snapshot.opening_date).days
                task.evidence = [e.model_dump(mode="json") for e in item.evidence]
        store.business_type, store.onboarded_at = result.business_type, store.onboarded_at or now_utc()
        for c in cost.rows:
            session.add(CostLog(run_id=row.id, store_id=store.id, step=c.step, model=c.model,
                                input_tokens=c.input_tokens, output_tokens=c.output_tokens, cost_krw=c.cost_krw))
        session.flush()
        sync_links(pack, cards, tasks, now_utc())
        alerts = {a.dedupe_key: a for a in session.scalars(select(Alert).where(Alert.store_id == store.id))}
        for card in cards:
            key = f"dec-{card.item_key}"
            if is_pending_decision(card):
                if key not in alerts:
                    session.add(decision_alert(store, card))
                else:
                    alerts[key].title = card.title
            elif key in alerts:
                session.delete(alerts[key])
        if deadline is not None and time.monotonic() >= deadline:
            raise ValueError("ANALYSIS_TIMEOUT")
        summary = {k: sum(current_verdict(c) == k for c in cards) for k in ("high", "low", "unknown", "ok")}
        row.status, row.finished_at = "done", now_utc()
        row.events = [*(row.events or []), _event("done", {"run_id": str(row.id), "summary": summary,
                                                        "cost_krw": result.cost_krw})]


def read_run(run_id: uuid.UUID) -> dict:
    with transaction() as session:
        row = session.get(Run, run_id)
        if row is None:
            raise ApiError(404, "RUN_NOT_FOUND", "분석 실행을 찾을 수 없습니다.")
        if row.status in ACTIVE and (row.started_at or row.created_at) < now_utc() - timedelta(seconds=get_settings().analysis_timeout_seconds):
            row = session.scalar(select(Run).where(Run.id == run_id).with_for_update())
            if row.status in ACTIVE:
                _fail(row, "ANALYSIS_TIMEOUT", "분석 제한 시간을 초과했습니다.")
        return {"run_id": str(row.id), "trigger": row.trigger, "status": row.status,
                "scope": row.scope or [],
                "events": row.events or [], "error": row.error,
                "started_at": iso_kst(row.started_at), "finished_at": iso_kst(row.finished_at)}


class AnalysisManager:
    def __init__(self, *, timeout=None, workers=None, runner=None, dependencies=None):
        settings = get_settings()
        self.timeout = timeout or settings.analysis_timeout_seconds
        self.executor = ThreadPoolExecutor(max_workers=workers or settings.analysis_workers)
        self.slots = threading.BoundedSemaphore(workers or settings.analysis_workers)
        self.runner = runner or run_analysis
        self.dependencies = dependencies

    def reserve(self):
        return self.slots.acquire(blocking=False)

    def release(self):
        self.slots.release()

    def submit(self, run_id, snapshot, scope):
        self.executor.submit(self._execute, run_id, snapshot, scope)

    def _execute(self, run_id, snapshot, scope):
        deadline = time.monotonic() + self.timeout
        timer = threading.Timer(self.timeout, self._timeout, args=(run_id,))
        timer.daemon = True
        timer.start()
        tools = None
        cost = CostTracker()
        try:
            with transaction() as session:
                row = session.scalar(select(Run).where(Run.id == run_id).with_for_update())
                if row is None or row.status != "queued":
                    return
                row.status, row.started_at = "running", now_utc()
            from tools.analysis import make_dependencies

            tools, llm = (self.dependencies or make_dependencies)(cost)
            result = self.runner(snapshot, tools=tools, calc=Dates(), llm=llm, scope=scope,
                                 emit=lambda event, data: append_event(run_id, event, data))
            persist_result(run_id, snapshot, result, cost, scope, deadline=deadline)
        except RunStopped:
            pass
        except Exception as exc:
            logger.error("분석 실행 실패: %s", type(exc).__name__)
            code = str(exc) if str(exc) in {"INPUT_CHANGED", "ANALYSIS_TIMEOUT"} else "ANALYSIS_FAILED"
            if str(exc) in {"LEGACY_REPORT_IDS", "LEGACY_CHECKLIST_IDS"}:
                code = "RESULT_VERSION_MISMATCH"
            message = {"INPUT_CHANGED": "분석 중 가게 조건이 바뀌었습니다. 다시 실행해 주세요.",
                       "ANALYSIS_TIMEOUT": "분석 제한 시간을 초과했습니다.",
                       "RESULT_VERSION_MISMATCH": "기존 결과와 현재 점검 항목이 달라 갱신하지 않았습니다. 담당자 확인이 필요합니다.",
                       "ANALYSIS_FAILED": "분석을 완료하지 못했습니다. 다시 시도해 주세요."}[code]
            try:
                fail_run(run_id, code, message)
            except Exception as failure:
                logger.error("실패 상태 저장 불가: %s", type(failure).__name__)
        finally:
            timer.cancel()
            try:
                try:
                    save_failed_costs(run_id, cost)
                except Exception as exc:
                    logger.error("실패 실행 비용 저장 불가: %s", type(exc).__name__)
                if tools is not None and hasattr(tools, "close"):
                    tools.close()
            finally:
                self.release()

    @staticmethod
    def _timeout(run_id):
        try:
            fail_run(run_id, "ANALYSIS_TIMEOUT", "분석 제한 시간을 초과했습니다.")
        except Exception as exc:
            logger.error("시간 초과 저장 불가: %s", type(exc).__name__)

    def close(self):
        self.executor.shutdown(wait=False)
