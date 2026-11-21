"use client";
/** 예시 계정 화면을 백엔드 API에 연결한다.
 *
 * - 로컬 엔진에서 예시 계정(uid "demo")으로 들어오면 POST /api/demo 로 서버 계정을 만들고 토큰을 저장한다.
 * - 대시보드·리포트·체크리스트·서류함·알림 데이터는 서버 응답으로 그린다.
 * - 카드 선택·진행 상태·체크·알림 읽음은 서버에 저장한 뒤 응답을 다시 받는다.
 * - 서버에 연결하지 못하면 로컬 예시 데이터로 계속 동작한다 ("예시로 해보기"는 끝까지 돌아가야 한다).
 */
import { ApiError, apiEnabled } from "@/lib/api/client";
import { createApiModel, toEvidence, type ApiModel } from "@/lib/api/contexts";
import {
  clearSession,
  createStoreApi,
  loadSession,
  startDemoSession,
  type ApiSession,
} from "@/lib/api/foundy-api";
import { optionMeta } from "@/lib/report/option-meta";
import { iso, realToday } from "@/lib/date";
import { type FoundyStore } from "@/types/foundy";
import { useCallback, useEffect, useRef, useState } from "react";

const RUN_POLL_MS = 1500;
const RUN_POLL_LIMIT = 120;

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "RUN_IN_PROGRESS") return "분석이 진행 중이에요 · 끝난 뒤 다시 시도해 주세요";
    return error.message;
  }
  return "요청을 처리하지 못했어요";
}

export function useApiBridge(engine: FoundyStore | null, uid: string | null) {
  const [model, setModel] = useState<ApiModel | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sessionRef = useRef<ApiSession | null>(null);
  const starting = useRef(false);

  const active = apiEnabled() && uid === "demo" && !failed;

  const refresh = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      setModel(createApiModel(await createStoreApi(session).loadBundle()));
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        // 토큰 만료·계정 삭제: 새 예시 계정을 다시 만든다.
        clearSession();
        sessionRef.current = null;
        starting.current = false;
        setModel(null);
        setAttempt((n) => n + 1);
        return;
      }
      setFailed(true);
      engine?.showToast("서버에 연결하지 못해 예시 데이터로 보여 드려요");
    }
  }, [engine]);

  // 예시 계정으로 들어오면 서버 세션을 준비하고, 나가면 지운다.
  useEffect(() => {
    if (!apiEnabled() || !engine) return;
    if (uid !== "demo") {
      if (uid === null) clearSession();
      sessionRef.current = null;
      starting.current = false;
      setModel(null);
      setFailed(false);
      return;
    }
    if (failed || sessionRef.current || starting.current) return;
    if (attempt > 2) {
      setFailed(true);
      return;
    }
    starting.current = true;
    void (async () => {
      try {
        sessionRef.current = loadSession() ?? (await startDemoSession());
        await refresh();
      } catch {
        setFailed(true);
        engine.showToast("서버에 연결하지 못해 예시 데이터로 보여 드려요");
      } finally {
        starting.current = false;
      }
    })();
  }, [engine, uid, failed, attempt, refresh]);

  const waitForRun = useCallback(
    async (runId: string) => {
      const session = sessionRef.current;
      if (!session) return;
      const api = createStoreApi(session);
      for (let i = 0; i < RUN_POLL_LIMIT; i++) {
        await new Promise((resolve) => setTimeout(resolve, RUN_POLL_MS));
        const run = await api.runStatus(runId).catch(() => null);
        if (run && run.status !== "queued" && run.status !== "running") {
          await refresh();
          engine?.showToast(run.status === "done" ? "다시 점검한 결과를 반영했어요" : "다시 점검하지 못했어요 · 잠시 후 다시 시도해 주세요");
          return;
        }
      }
    },
    [engine, refresh],
  );

  const run = useCallback(
    async (work: (api: ReturnType<typeof createStoreApi>) => Promise<string | void>) => {
      const session = sessionRef.current;
      if (!session) return;
      engine?.showToast("저장하는 중이에요…");
      try {
        const message = await work(createStoreApi(session));
        await refresh();
        if (message) engine?.showToast(message);
      } catch (error) {
        engine?.showToast(errorMessage(error));
      }
    },
    [engine, refresh],
  );

  const choose = useCallback(
    (itemId: string, optionId: string) =>
      run(async (api) => {
        const result = await api.choose(itemId, optionId);
        if (result.run_id) void waitForRun(result.run_id);
        const label = model?.cards.find((c) => c.id === itemId)?.options.find((o) => o.id === optionId)?.label;
        return result.run_id
          ? `“${label ?? "선택"}” 적용 · 바뀐 조건으로 다시 점검하는 중이에요`
          : `“${label ?? "선택"}” 적용 · 변경 내용을 카드에서 확인하세요`;
      }),
    [model, run, waitForRun],
  );

  /** 서버 데이터가 필요한 이벤트만 처리하고 true 를 돌려준다. 나머지(이동·필터·보기 전환)는 로컬 엔진이 처리한다. */
  const handleEvent = useCallback(
    (type: string, event: { target: EventTarget; preventDefault(): void }): boolean => {
      if (!active || !model || !engine || type !== "click") return false;
      const target = event.target as HTMLElement;
      const taskRow = target.closest?.("[data-task]") as HTMLElement | null;
      const button = target.closest?.("[data-nx]") as HTMLElement | null;

      if (taskRow && !button) {
        const id = taskRow.dataset.task ?? "";
        const task = model.allTasks().find((t) => t.id === id);
        if (!task) return true;
        void run(async (api) => {
          await api.setTaskDone(id, !task.done);
          return task.done ? "체크를 해제했어요" : "완료로 체크했어요";
        });
        return true;
      }
      if (!button) return false;
      const id = button.dataset.id ?? "";
      const card = model.cards.find((c) => c.id === id);
      switch (button.dataset.nx) {
        case "opt": {
          const option = card?.options.find((o) => o.id === button.dataset.o);
          if (!card || !option) return true;
          engine.showModal("선택지 적용 확인", {
            kind: "option-confirm",
            cardId: card.id,
            optionId: option.id,
            label: option.label,
            summary: option.summary,
            changes: option.fx.changes,
            recommended: card.rec?.id === option.id,
            reason: card.rec?.id === option.id ? card.rec.reason : undefined,
            meta: optionMeta(option),
          });
          return true;
        }
        case "confirm":
          engine.closeModal();
          void choose(id, button.dataset.o ?? "");
          return true;
        case "rec":
          if (card?.rec) void choose(id, card.rec.id);
          return true;
        case "undo":
          engine.showToast("선택을 바꾸려면 다른 선택지를 골라 주세요");
          return true;
        case "act":
          void run(async (api) => {
            await api.action(id, "sent");
            return "문의 기록 완료 · 먼저 할 일을 정리했어요";
          });
          return true;
        case "actdone": {
          const memo = document.getElementById(`memo-${id}`) as HTMLTextAreaElement | null;
          void run(async (api) => {
            const result = await api.action(id, "done", memo?.value.trim() || undefined);
            const auto = result.auto_checked
              .map((taskId) => model.allTasks().find((t) => t.id === taskId)?.task)
              .filter(Boolean);
            return (
              "완료! 다음으로 할 일을 정리했어요" +
              (auto.length ? ` · 체크리스트 “${auto[0]}”${auto.length > 1 ? ` 외 ${auto.length - 1}개` : ""}도 자동 체크` : "")
            );
          });
          return true;
        }
        case "actreset":
          void run(async (api) => {
            await api.action(id, "pending");
          });
          return true;
        case "evid":
        case "cevid": {
          const item = model.byId.get(id);
          if (!item) return true;
          engine.showModal("판정 근거", {
            kind: "evidence",
            items: item.evidence.map(toEvidence),
            date: iso(realToday()),
          });
          return true;
        }
        default:
          return false;
      }
    },
    [active, model, engine, run, choose],
  );

  const openNotification = useCallback(
    (id: string): boolean => {
      if (!active || !model || !engine) return false;
      const alert = model.notifications.find((n) => n.id === id);
      if (!alert) return true;
      void run(async (api) => {
        if (!alert.read) await api.readAlert(id);
      });
      engine.navigateTo(alert.destination);
      if (alert.focus)
        setTimeout(
          () => document.getElementById(`result-${alert.focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
          60,
        );
      return true;
    },
    [active, model, engine, run],
  );

  return {
    /** 서버 데이터로 화면을 그리는 중이면 모델, 아니면 null (로컬 예시 데이터 사용) */
    model: active ? model : null,
    /** 서버 데이터를 기다리는 중 (화면은 로딩 표시) */
    pending: active && !model,
    handleEvent,
    openNotification,
  };
}
