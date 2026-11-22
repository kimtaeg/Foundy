"""분석 실행·이벤트·결과 저장. 외부 호출과 결과 저장 트랜잭션은 분리한다."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import json
import logging
import threading
import time
import uuid

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from agent.analysis_cache import AnalysisResponseCache, CachedAnalysisLLM
from agent.cost import CostTracker
from agent.loop import run_analysis
from agent.ports import StoreInput
from api.errors import ApiError, invalid_input
from calc.dates import Dates
from config import get_settings
from db.models import Alert, ChecklistItem, CostLog, ReportItem, Run, Store
from db.session import transaction
from services.cards import current_verdict, decision_alert, is_pending_decision, load_cards
from services.documents import sync_requirements
from services.effective import effective_store
from services.links import sync_links
from services.pack import get_pack
from services.store_setup import missing_fields
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
                      area_sqm=float(eff["area_sqm"]) if eff["area_sqm"] is not None else None,
                      answers={k: eff[k] for k in ("sells_alcohol", "uses_terrace", "has_employees", "funds_krw",
                                                   "does_delivery")})


def _fingerprint(value: StoreInput) -> str:
    return json.dumps(value.model_dump(mode="json"), sort_keys=True, ensure_ascii=False)


def _event(event: str, data: dict) -> dict:
    return {"event": event, "data": data, "at": iso_kst(now_utc())}


def _fail(row: Run, code: str, message: str) -> None:
    row.status, row.error, row.finished_at = "failed", message, now_utc()
    row.events = [*(row.events or []), _event("error", {"code": code, "message": message})]


def _locked_active_runs(session, store_id=None) -> list[Run]:
    query = select(Run).where(Run.status.in_(ACTIVE))
    if store_id is not None:
        query = query.where(Run.store_id == store_id)
    return list(session.scalars(query.with_for_update()))


def _expire_runs(session, rows: list[Run]) -> int:
    deadline = now_utc() - timedelta(seconds=get_settings().analysis_timeout_seconds)
    count = 0
    for row in rows:
        if (row.started_at or row.created_at) < deadline:
            _fail(row, "ANALYSIS_TIMEOUT", "분석 제한 시간을 초과했습니다.")
            count += 1
    session.flush()
    return count


def expire_stale(session, store_id=None) -> int:
    return _expire_runs(session, _locked_active_runs(session, store_id))


def run_in_progress() -> ApiError:
    return ApiError(409, "RUN_IN_PROGRESS", "이미 분석이 실행 중입니다.")


def lock_store(session, store: Store) -> Store:
    """가게 행을 잠그고 실행 중인 분석이 있으면 409. 분석 요청·카드 선택·가게 수정이 먼저 부른다.

    잠금은 트랜잭션이 끝날 때까지 유지되므로, 이후의 변경과 새 run 저장이 다른 요청과 섞이지 않는다.
    """
    store = session.scalar(select(Store).where(Store.id == store.id).with_for_update()
                           .execution_options(populate_existing=True))
    active = _locked_active_runs(session, store.id)
    if _expire_runs(session, active) < len(active):
        raise run_in_progress()
    return store


def _active_conflict(exc: IntegrityError) -> bool:
    return getattr(getattr(exc.orig, "diag", None), "constraint_name", None) == "runs_one_active"


def start_run(session, store: Store, manager: "AnalysisManager", scope: list[str], *,
              cards: list[ReportItem] | None = None) -> uuid.UUID:
    """잠근 가게(lock_store)에 run을 만들고, 지금까지의 변경과 함께 한 번에 커밋한 뒤 실행을 맡긴다.

    커밋 전에 실패하면 호출한 쪽의 변경도 함께 롤백된다 (변경만 저장되고 분석이 안 도는 상태를 만들지 않는다).
    """
    session.flush()
    if cards is None:
        cards = load_cards(session, store)
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
        if _active_conflict(exc):
            raise run_in_progress() from exc
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


def create_run(session, store: Store, manager: "AnalysisManager", scope: list[str]):
    store = lock_store(session, store)
    if store.onboarded_at is None:
        missing = missing_fields(store)
        if missing:
            raise ApiError(422, "SETUP_INCOMPLETE", "마이페이지에서 가게 정보와 영업 조건을 먼저 입력해 주세요.",
                           {"missing_fields": missing})
        scope = list(CORE_SCOPE)
    return start_run(session, store, manager, scope)


def reanalysis_scope(steps: list[str]) -> list[str]:
    """영향 단계(impacts.run) → 재분석 범위. 외부 조회·AI가 필요한 단계(building·law·trademark)가 있을 때만 돈다.

    checklist만 있으면(직원 여부 등) 규칙 묶음으로 바로 갱신하므로 재분석하지 않는다.
    dates·grants·costs는 분석 run의 범위가 아니다.
    """
    if not {"building", "law", "trademark"} & set(steps):
        return []
    return [s for s in CORE_SCOPE if s in steps]


def append_event(run_id: uuid.UUID, event: str, data: dict) -> None:
    if event == "done":
        return  # 분석 함수의 완료는 DB 저장이 끝난 뒤에만 공개한다.
    if event not in {"step", "item", "error"}:
        raise ValueError("Unsupported analysis event")
    with transaction() as session:
        result = session.execute(update(Run).where(Run.id == run_id, Run.status.in_(ACTIVE))
                                 .values(events=Run.events.concat([_event(event, data)])))
        if result.rowcount == 0:
            raise RunStopped()


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


def obligation_spec(pack: dict, item_key: str) -> dict:
    """법령 규칙(applicability_rules)의 task 중 id 가 item_key 인 것. 없으면 빈 값 (연락처 등을 지어내지 않는다)."""
    for rule in pack.get("applicability_rules") or []:
        if (rule.get("task") or {}).get("id") == item_key:
            return rule["task"]
    return {}


def _save_obligations(session, store_id, run_id, outcomes) -> None:
    """규칙 엔진이 정한 법령 적용 결과를 가게별로 저장한다 (같은 규칙은 덮어쓴다)."""
    from db.models import LegalObligation

    existing = {o.rule_id: o for o in session.scalars(select(LegalObligation).where(LegalObligation.store_id == store_id))}
    for outcome in outcomes:
        row = existing.get(outcome.rule_id)
        if row is None:
            row = LegalObligation(store_id=store_id, rule_id=outcome.rule_id)
            session.add(row)
        row.run_id, row.title, row.status, row.reason = run_id, outcome.title, outcome.status, outcome.reason
        row.missing_inputs, row.law_name = outcome.missing_inputs, outcome.law_name
        row.article_label, row.required_action = outcome.article_label, outcome.required_action
    keep = {o.rule_id for o in outcomes}
    for rule_id, row in existing.items():
        if outcomes and rule_id not in keep:
            session.delete(row)


def persist_result(run_id, snapshot, result, cost, scope, deadline=None, item_events=()):
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
        for check_id in getattr(result, "skipped_checks", []):
            stale = by_check.get(check_id)
            if stale is not None and not stale.chosen_option and stale.action_status == "pending":
                session.delete(stale)  # 면적·직원 등이 바뀌어 더는 적용되지 않는 규정의 카드는 지운다
                cards.remove(stale)
                for alert in session.scalars(select(Alert).where(Alert.store_id == store.id,
                                                                 Alert.dedupe_key == f"dec-{stale.item_key}")):
                    session.delete(alert)
        if "law" in scope:
            _save_obligations(session, store.id, row.id, getattr(result, "obligations", []))
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
                spec = next((t for t in pack["checklist"] if t["id"] == item.item_id), None) or obligation_spec(pack, item.item_id)
                task.rule_key, task.contact_key = item.rule_key, spec.get("contact")
                for key in ("task", "category", "group_label", "due_date", "agency"):
                    setattr(task, key, getattr(item, key))
                task.offset_days = (item.due_date - snapshot.opening_date).days
                task.evidence = [e.model_dump(mode="json") for e in item.evidence]
                lost = bool(task.obligation_rule_id) and not item.obligation_rule_id  # 이전엔 의무였는데 이번엔 적용 안 됨
                for key in ("task_type", "source_type", "priority", "deadline_type", "statutory_deadline",
                            "statutory_basis", "reason", "obligation_rule_id"):
                    setattr(task, key, getattr(item, key))
                task.law_basis, task.sources = item.law_basis, item.sources
                task.review_needed, task.review_reason = False, None  # 방금 새 법령으로 다시 분석했으니 재검토 표시는 푼다
                if lost and task.done:  # 완료 기록은 남기고 사용자가 알 수 있게 표시한다
                    task.review_needed, task.review_reason = True, "이 규정이 더 이상 적용되지 않는 것으로 다시 분석됐어요. 완료 기록은 남겨 둡니다."
                    task.review_flagged_at = now_utc()
            made = {i.item_id for i in result.checklist}
            for task in list(tasks):  # 이전 분석에서 만든 법령 작업이 이번에는 만들어지지 않았다
                if task.source_type not in ("rule_engine", "legal_analysis") or task.item_key in made:
                    continue
                if task.done:
                    task.review_needed, task.review_flagged_at = True, now_utc()
                    task.review_reason = "이 규정이 더 이상 적용되지 않는 것으로 다시 분석됐어요. 완료 기록은 남겨 둡니다."
                else:
                    session.delete(task)
                    tasks.remove(task)
        store.business_type, store.onboarded_at = result.business_type, store.onboarded_at or now_utc()
        if getattr(result, "address_codes", None) and not store.address_codes:
            # 주소를 바꿔 비워 둔 코드를 새 주소의 실제 조회 결과로 채운다. 조회에 실패하면 비운 채로 둔다 (110 안내)
            store.address_codes = result.address_codes
        for c in cost.rows:
            session.add(CostLog(run_id=row.id, store_id=store.id, step=c.step, model=c.model,
                                input_tokens=c.input_tokens, output_tokens=c.output_tokens, cost_krw=c.cost_krw))
        session.flush()
        sync_links(pack, cards, tasks, now_utc())
        sync_requirements(session, pack, store, cards, tasks)  # 서류함: 법령 판정 결과로 필요한 서류를 맞춘다
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
        row.events = [*(row.events or []), *item_events, _event("done", {"run_id": str(row.id), "summary": summary,
                                                        "cost_krw": result.cost_krw})]


def read_run_state(session, row: Run) -> dict:
    if row.status in ACTIVE and (row.started_at or row.created_at) < now_utc() - timedelta(seconds=get_settings().analysis_timeout_seconds):
        row = session.scalar(select(Run).where(Run.id == row.id).with_for_update()
                             .execution_options(populate_existing=True))
        if row.status in ACTIVE:
            _fail(row, "ANALYSIS_TIMEOUT", "분석 제한 시간을 초과했습니다.")
    return {"run_id": str(row.id), "trigger": row.trigger, "status": row.status, "scope": row.scope or [],
            "events": row.events or [], "error": row.error,
            "started_at": iso_kst(row.started_at), "finished_at": iso_kst(row.finished_at)}


def read_run(run_id: uuid.UUID) -> dict:
    with transaction() as session:
        row = session.get(Run, run_id)
        if row is None:
            raise ApiError(404, "RUN_NOT_FOUND", "분석 실행을 찾을 수 없습니다.")
        return read_run_state(session, row)


class AnalysisManager:
    def __init__(self, *, timeout=None, workers=None, runner=None, dependencies=None):
        settings = get_settings()
        self.timeout = timeout or settings.analysis_timeout_seconds
        self.executor = ThreadPoolExecutor(max_workers=workers or settings.analysis_workers)
        self.slots = threading.BoundedSemaphore(workers or settings.analysis_workers)
        self.runner = runner or run_analysis
        self.dependencies = dependencies
        self.response_cache = AnalysisResponseCache()

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
            if hasattr(llm, "analysis_cache_identity"):
                llm = CachedAnalysisLLM(llm, self.response_cache, snapshot.store_id)
            item_events = []

            def emit(event, data):
                if event == "item":
                    item_events.append(_event(event, data))
                else:
                    append_event(run_id, event, data)

            result = self.runner(snapshot, tools=tools, calc=Dates(), llm=llm, scope=scope, emit=emit)
            persist_result(run_id, snapshot, result, cost, scope, deadline=deadline, item_events=item_events)
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
