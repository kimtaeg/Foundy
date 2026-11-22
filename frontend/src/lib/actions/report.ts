import { optionMeta } from "@/lib/report/option-meta";
import { type ActionHandlers } from "@/types/actions";
import type { ChecklistTask } from "@/types/checklist";
import { type DialogContent } from "@/types/dialog";
import { type ReportCardData, type ReportState } from "@/types/report";

// Unselected persisted actions use null; selected report views use a string ID.
type PersistedReportState = Omit<ReportState, "chosen"> & {
  chosen?: string | null;
};
interface ReportActionContext {
  reportFilter: string;
  buildCards(): ReportCardData[];
  modal(
    title: string,
    content: Extract<DialogContent, { kind: "option-choices" | "option-confirm" }>,
  ): void;
  closeModal(): void;
  applyChoice(cardId: string, optionId: string): boolean;
  openOptionResult(cardId: string): void;
  RS: Record<string, PersistedReportState>;
  put(key: string, value: unknown): void;
  logNext(cardId: string, status: NonNullable<ReportState["action"]>): void;
  syncLinks(): Pick<ChecklistTask, "id" | "task">[];
  toast(message: string): void;
  showNext(cardId: string): void;
  $(id: string): HTMLElement | null;
  evidenceModal(cardId: string): void;
}

/** Commands emitted by report views; view layout is deliberately absent. */
export function createReportActions(
  context: ReportActionContext,
): ActionHandlers {
  return {
    rfilter: (b: HTMLElement) => {
      const v = b.dataset.v ?? "";

      context.reportFilter = v;

      return true;
    },
    options: (b: HTMLElement) => {
      const card = context.buildCards().find((item) => item.id === b.dataset.id);
      if (!card?.options.length) return true;
      if (card.options.some((option) => option.id === context.RS[card.id]?.chosen)) {
        context.openOptionResult(card.id);
      } else {
        context.modal("선택지 비교", { kind: "option-choices", card });
      }
      return true;
    },
    opt: (b: HTMLElement) => {
      const id = b.dataset.id ?? "";

      const card = context.buildCards().find((item) => item.id === id);
      const option = card?.options.find((item) => item.id === b.dataset.o);
      if (!card || !option) return true;
      context.modal("선택지 적용 확인", {
        kind: "option-confirm",
        cardId: id,
        optionId: option.id,
        label: option.label,
        summary: option.summary,
        changes: option.fx.changes,
        recommended: card.rec?.id === option.id,
        reason: card.rec?.id === option.id ? card.rec.reason : undefined,
        meta: optionMeta(option),
      });

      return true;
    },
    confirm: (b: HTMLElement) => {
      const id = b.dataset.id ?? "";

      if (context.applyChoice(id, b.dataset.o ?? "")) context.openOptionResult(id);
      else context.closeModal();

      return true;
    },
    rec: (b: HTMLElement) => {
      const id = b.dataset.id ?? "";

      const card = context.buildCards().find((item) => item.id === id);
      if (card?.rec && context.applyChoice(id, card.rec.id)) context.openOptionResult(id);

      return true;
    },
    optionresult: (b: HTMLElement) => {
      context.openOptionResult(b.dataset.id ?? "");
      return true;
    },
    act: (b: HTMLElement) => {
      const id = b.dataset.id ?? "";

      context.RS[id] = Object.assign(
        { chosen: null, reply: "" },
        context.RS[id],
        { action: "sent" },
      );
      context.put("rs", context.RS);
      context.logNext(id, "sent");
      context.toast("문의 기록 완료 · 먼저 할 일을 정리했어요");
      context.showNext(id);

      return true;
    },
    actdone: (b: HTMLElement) => {
      const id = b.dataset.id ?? "";

      const m = context.$("memo-" + id) as HTMLTextAreaElement | null;
      context.RS[id] = Object.assign({}, context.RS[id], {
        action: "done",
        reply: m ? m.value : "",
      });
      context.put("rs", context.RS);
      context.logNext(id, "done");
      const au = context.syncLinks();
      context.toast(
        "완료! 다음으로 할 일을 자동으로 정리했어요" +
          (au.length
            ? " · 체크리스트 “" +
              au[0].task +
              "”" +
              (au.length > 1 ? " 외 " + (au.length - 1) + "개" : "") +
              "도 자동 체크"
            : ""),
      );
      context.showNext(id);

      return true;
    },
    actreset: (b: HTMLElement) => {
      const id = b.dataset.id ?? "";

      context.RS[id] = Object.assign({}, context.RS[id], {
        action: "pending",
        reply: "",
      });
      context.put("rs", context.RS);
      context.logNext(id, "pending");
      context.syncLinks();

      return true;
    },
    evid: (b: HTMLElement) => {
      const id = b.dataset.id ?? "";

      context.evidenceModal(id);
      return true;
    },
    cevid: (b: HTMLElement) => {
      const id = b.dataset.id ?? "";

      context.evidenceModal(id);

      return true;
    },
  };
}
