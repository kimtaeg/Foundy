"use client";

import { useRef, type SyntheticEvent } from "react";
import { toast } from "sonner";
import { patchChecklistTask, patchDashboardTask, patchDocumentStatus, patchDocumentTask } from "@/lib/api/checklist-mutations";
import { createStoreApi, loadSession, sessionSnapshot, type StoreApi } from "@/lib/api/foundy-api";
import type { ApiModel } from "@/lib/api/contexts";
import type { ApiAlert, ApiChecklistState, ApiDashboard, ApiDocumentState, ApiResource, ApiResources } from "@/lib/api/types";
import { downloadChecklistCalendar } from "@/lib/checklist-calendar";
import { focusNavigationItem } from "@/lib/routes";
import type { FoundyContextValue } from "@/types/app";
import type { FoundyStore } from "@/types/foundy";

interface Mutation<T> {
  optimistic: () => void;
  save: (api: StoreApi) => Promise<T>;
  confirm: (value: T) => void;
  rollback: () => void;
}

export function useChecklistAlertActions(
  engine: FoundyStore | null, model: ApiModel | null, apiActive: boolean,
  refreshApi: FoundyContextValue["refreshApi"],
  update: <K extends ApiResource>(key: K, change: (resource: ApiResources[K]) => ApiResources[K],
    invalidateMissing?: boolean, preserveInvalidation?: boolean) => void,
) {
  const pending = useRef(new Set<string>());
  function mutate<T>(key: string, mutation: Mutation<T>, input?: HTMLInputElement | HTMLSelectElement) {
    const uid = engine?.getSnapshot().uid;
    const session = loadSession(uid === "demo" ? "demo" : "account");
    if (!session?.storeId || session.storeId !== model?.bundle.me?.store_id) {
      toast.error("가게 세션을 다시 확인해 주세요.");
      return false;
    }
    const sessionKey = sessionSnapshot();
    const operation = `${sessionKey}:${key}`;
    if (pending.current.has(operation)) return false;
    pending.current.add(operation);
    if (input) input.disabled = true;
    void (async () => {
      try {
        mutation.optimistic();
        const saved = await mutation.save(createStoreApi(session));
        if (sessionSnapshot() === sessionKey) mutation.confirm(saved);
      } catch (error) {
        if (sessionSnapshot() === sessionKey) {
          mutation.rollback();
          toast.error(error instanceof Error ? error.message : "저장하지 못했어요. 다시 시도해 주세요.");
        }
      } finally {
        pending.current.delete(operation);
        if (input) input.disabled = false;
      }
    })();
    return true;
  }

  function applyTask(state: ApiChecklistState, saved: boolean) {
    update("checklist", checklist => patchChecklistTask(checklist, state), saved, true);
    update("dashboard", dashboard => patchDashboardTask(dashboard, state), saved, true);
    update("documents", documents => patchDocumentTask(documents, state), saved, true);
  }

  function applyDocument(state: Pick<ApiDocumentState, "doc_key" | "status"> & Partial<ApiDocumentState>, saved: boolean) {
    let progress: ApiDashboard["documents_progress"];
    update("documents", documents => {
      const next = patchDocumentStatus(documents, state);
      progress = { finished: next.summary.finished, total: next.summary.total };
      return next;
    }, saved, true);
    update("dashboard", dashboard => progress ? { ...dashboard, documents_progress: progress } : dashboard, saved, true);
  }

  function handleChecklistEvent(type: string, event: SyntheticEvent<HTMLElement>): boolean {
    if (!apiActive || !(event.target instanceof Element)) return false;
    const target = event.target;
    if (type === "click" && target.closest('[data-nx="ics"]')) {
      const storeId = model?.bundle.me?.store_id;
      if (storeId && model?.checklist) downloadChecklistCalendar(storeId, model.checklist.S.opening, model.allTasks());
      return true;
    }
    if (type === "click" && target instanceof HTMLInputElement && target.dataset.task) {
      const task = model?.allTasks().find(item => item.id === target.dataset.task);
      if (task) {
        const previous = model?.bundle.checklist?.groups.flatMap(group => group.items).find(item => item.item_id === task.id);
        const state = { item_id: task.id, done: !task.done, auto_checked: false };
        const started = mutate(`task:${task.id}`, {
          optimistic: () => applyTask(state, false),
          save: api => api.setTaskDone(task.id, state.done),
          confirm: saved => {
            applyTask(saved, true);
            // 리포트의 다음 할 일은 서버가 정렬하므로 방문할 때 최신 값을 읽는다.
            void refreshApi(["report"]);
          },
          rollback: () => applyTask({ ...state, done: task.done, auto_checked: previous?.auto_checked ?? false }, true),
        }, target);
        if (started) return true;
      }
      event.preventDefault();
      return true;
    }
    if (type === "change" && target instanceof HTMLSelectElement && target.dataset.documentStatus) {
      const previous = model?.bundle.documents?.requirements.find(item => item.doc_key === target.dataset.documentStatus);
      if (previous) {
        const status = target.value as ApiDocumentState["status"];
        const docKey = previous.doc_key;
        mutate(`doc:${docKey}`, {
          optimistic: () => applyDocument({ doc_key: docKey, status }, false),
          save: api => api.setDocumentStatus(docKey, status),
          confirm: ({ catalog_changed, doc_key, status, status_label, note, status_updated_at, review_needed, review_reason }) => {
            applyDocument({ doc_key, status, status_label, note, status_updated_at, review_needed, review_reason }, true);
            if (catalog_changed) void refreshApi(["documents", "dashboard"]);
          },
          rollback: () => applyDocument({ doc_key: docKey, status: previous.status }, true),
        }, target);
      }
      return true;
    }
    return false;
  }

  function openApiNotification(id: string): boolean {
    if (!apiActive) return false;
    const alert = model?.notifications.find(item => item.id === id);
    if (!alert || !engine) return true;
    if (!alert.read && !id.startsWith("ex-")) {
      const applyAlert = (read: boolean, settled: boolean, saved?: ApiAlert) => {
        let unreadChange = 0;
        update("alerts", alerts => alerts.map(entry => {
          if (entry.alert_id !== id) return entry;
          unreadChange = Number(entry.read) - Number(read);
          return saved ?? { ...entry, read };
        }), settled, true);
        update("dashboard", dashboard => unreadChange ? {
          ...dashboard, alerts: { unread: dashboard.alerts.unread + unreadChange },
        } : dashboard, settled, true);
      };
      mutate(`alert:${id}`, {
        optimistic: () => applyAlert(true, false),
        save: api => api.readAlert(id),
        confirm: saved => applyAlert(saved.read, true, saved),
        rollback: () => applyAlert(false, true),
      });
    }
    engine.navigate(alert.destination);
    focusNavigationItem(alert.destination, alert.focus);
    return true;
  }
  return { handleChecklistEvent, openApiNotification };
}
