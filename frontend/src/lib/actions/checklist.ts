import { type ActionHandlers } from "@/types/actions";
import { type CalendarState } from "@/types/checklist";
import { type DialogContent } from "@/types/dialog";
import { type Store } from "@/types/store";

interface ChecklistActionContext {
  checkView: "timeline" | "category" | "calendar";
  ensureCal(): void;
  CAL: Omit<CalendarState, "sel"> & { sel: string | null | undefined };
  icsDownload(): void;
  modal(
    title: string,
    content: Extract<DialogContent, { kind: "opening-date" }>,
  ): void;
  S: Pick<Store, "opening">;
}

/** Commands emitted by checklist views; view layout is deliberately absent. */
export function createChecklistActions(
  context: ChecklistActionContext,
): ActionHandlers {
  return {
    cview: (b: HTMLElement) => {
      const v = b.dataset.v ?? "";

      if (v === "timeline" || v === "category" || v === "calendar")
        context.checkView = v;

      return true;
    },
    calmove: (b: HTMLElement) => {
      context.ensureCal();
      const d = new Date(context.CAL.y, context.CAL.m + Number(b.dataset.n), 1);
      context.CAL.y = d.getFullYear();
      context.CAL.m = d.getMonth();

      return true;
    },
    calday: (b: HTMLElement) => {
      context.CAL.sel = b.dataset.d;

      return true;
    },
    ics: () => {
      context.icsDownload();
      return true;
    },
    editDate: () => {
      context.modal("개업 예정일 변경", {
        kind: "opening-date",
        opening: context.S.opening,
      });

      return true;
    },
  };
}
