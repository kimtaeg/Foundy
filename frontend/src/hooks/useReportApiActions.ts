"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { type ApiModel, toEvidence } from "@/lib/api/contexts";
import { createStoreApi, loadSession } from "@/lib/api/foundy-api";
import { followRun } from "@/lib/api/run-stream";
import { toReportNextStep } from "@/lib/report/api-next-step";
import { getReportCardModel } from "@/lib/report/card-model";
import { optionMeta } from "@/lib/report/option-meta";
import type { FoundyContextValue } from "@/types/app";
import type { ApiReportMutationUpdate, ApiResource } from "@/lib/api/types";
import type { ApplicationDialog } from "@/types/dialog";
import type { NextStep } from "@/types/report";

interface Props {
  api: ApiModel | null;
  apiActive: boolean;
  refreshApi: FoundyContextValue["refreshApi"];
  updateApi: FoundyContextValue["updateApi"];
}

type DialogRequest = {
  storeId: string;
  cardId: string;
} & (
  | { kind: "choices" | "evidence" }
  | { kind: "confirm"; optionId: string }
  | { kind: "result"; nextSteps?: NextStep[] }
);

function reportDialog(api: ApiModel | null, request: DialogRequest | null): ApplicationDialog | null {
  if (!api?.report || !request || request.storeId !== api.bundle.report?.store_id) return null;
  const card = api.cards.find((entry) => entry.id === request.cardId);
  const item = api.byId.get(request.cardId);
  if (!card || !item) return null;
  if (request.kind === "evidence") {
    return { title: "판정 근거", content: { kind: "evidence", items: item.evidence.map(toEvidence) } };
  }
  if (request.kind === "choices" && !item.chosen_option)
    return { title: "선택지 비교", content: { kind: "option-choices", card } };
  if (request.kind === "confirm" && !item.chosen_option) {
    const option = card.options.find((o) => o.id === request.optionId);
    if (!option) return null;
    const recommended = card.rec?.id === option.id;
    return { title: "선택지 적용 확인", content: {
      kind: "option-confirm", cardId: card.id, optionId: option.id, label: option.label,
      summary: option.summary, changes: option.fx.changes, meta: optionMeta(option),
      recommended, reason: recommended ? card.rec?.reason : undefined,
    } };
  }
  const model = getReportCardModel(api.report, card);
  if (request.kind === "result" && request.nextSteps) model.nextSteps = request.nextSteps;
  return { title: item.chosen_option ? "선택 결과" : "후속 작업", content: { kind: "option-result", model } };
}

const reportCommands = new Set(["options", "opt", "optionresult", "confirm", "rec", "act", "actdone", "actreset", "evid", "cevid"]);

export function useReportApiActions({ api, apiActive, refreshApi, updateApi }: Props) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const writing = useRef(new Set<string>());
  const queues = useRef(new Map<string, Promise<void>>());

  function handleEvent(type: string, event: { target: EventTarget }): boolean {
    if (!apiActive || type !== "click" || !(event.target instanceof Element)) return false;
    const button = event.target.closest<HTMLElement>("[data-nx]");
    const command = button?.dataset.nx;
    if (!button || !command) return false;
    if (command === "go" || command === "cnav") setRequest(null);
    if (!reportCommands.has(command)) return false;
    const id = button.dataset.id ?? "";
    const card = api?.cards.find((entry) => entry.id === id);
    if (!api || !card) return true;

    const storeId = api.bundle.report?.store_id;
    if (!storeId) return true;
    const owner = { storeId, cardId: id };
    if (command === "options") setRequest({ ...owner, kind: "choices" });
    else if (command === "opt") setRequest({ ...owner, kind: "confirm", optionId: button.dataset.o ?? "" });
    else if (command === "optionresult") setRequest({ ...owner, kind: "result" });
    else if (command === "evid" || command === "cevid") setRequest({ ...owner, kind: "evidence" });
    else {
      const session = loadSession();
      if (!session || session.storeId !== storeId) {
        toast.error("로그인 정보를 다시 확인해 주세요.");
        return true;
      }
      const key = storeId + "/" + id;
      if (writing.current.has(key)) return true;
      const apiClient = createStoreApi(session);
      const current = () => {
        const active = loadSession(session.kind);
        return active?.token === session.token && active.storeId === storeId;
      };
      const optionId = command === "rec" ? card.rec?.id : button.dataset.o;
      const choosing = command === "confirm" || command === "rec";
      if (choosing && (api.RS[id]?.chosen || !optionId)) return true;
      const reply = document.querySelector<HTMLTextAreaElement>(`#memo-${CSS.escape(id)}`)?.value;
      writing.current.add(key);
      // Apply complete report snapshots in the order their writes reach the server.
      const previous = queues.current.get(storeId) ?? Promise.resolve();
      const write = previous.then(async () => {
        try {
          if (!current()) return;
          let nextSteps: NextStep[] | undefined;
          let runId: string | null = null;
          let update: ApiReportMutationUpdate;
          const affected: ApiResource[] = ["dashboard", "checklist", "documents"];
          if (choosing && optionId) {
            const result = await apiClient.choose(id, optionId);
            runId = result.run_id;
            update = result;
            affected.push("store");
          } else {
            const status = command === "actreset" ? "pending" : command === "act" ? "sent" : "done";
            const result = await apiClient.action(id, status, reply);
            nextSteps = result.next_steps.map(toReportNextStep);
            update = result;
          }
          if (!current()) return;
          const { report_update, alerts_update } = update;
          if (report_update) updateApi("report", (report) => ({ ...report, ...report_update }), true, true);
          if (alerts_update && api.bundle.alerts) {
            const { added, removed_ids } = alerts_update;
            updateApi("alerts", (alerts) => {
              const remaining = alerts.filter(alert => !removed_ids.includes(alert.alert_id));
              return added ? [added, ...remaining].sort((a, b) => b.created_at.localeCompare(a.created_at)) : remaining;
            }, true, true);
          } else affected.push("alerts");
          void refreshApi(affected);
          if (runId) {
            void followRun(runId, session.token, () => {}).then(
              () => { if (current()) void refreshApi(["report", "alerts", ...affected]); },
              (error: unknown) => {
                if (current()) toast.error("선택은 저장됐지만 재점검을 마치지 못했어요.", {
                  description: error instanceof Error ? error.message : undefined,
                });
              },
            );
          }
          if (!report_update && !(await refreshApi(["report"]))) return;
          if (!current()) return;
          setRequest((open) => open?.storeId === storeId && open.cardId === id && open.kind !== "evidence"
            ? { ...owner, kind: "result", nextSteps }
            : open);
        } catch (error) {
          if (!current()) return;
          if (error instanceof ApiError && error.status === 401) await refreshApi(["me"]);
          else toast.error(error instanceof Error ? error.message : "리포트를 저장하지 못했어요.");
        } finally {
          writing.current.delete(key);
        }
      });
      queues.current.set(storeId, write);
      void write.finally(() => {
        if (queues.current.get(storeId) === write) queues.current.delete(storeId);
      });
    }
    return true;
  }

  return {
    modal: apiActive ? reportDialog(api, request) : null,
    closeModal: () => setRequest(null),
    handleEvent,
  };
}
