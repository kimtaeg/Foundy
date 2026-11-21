import { type ActionHandlers } from "@/types/actions";
import { type DialogContent } from "@/types/dialog";
import { type StoreDraft } from "@/types/profile";

interface ProfileActionContext {
  mpDraft(): StoreDraft;
  applyMp(): void;
  MP: StoreDraft | null;
  modal(title: string, content: DialogContent): void;
  wipeStore(): void;
}

/** Commands emitted by profile views; view layout is deliberately absent. */
export function createProfileActions(
  context: ProfileActionContext,
): ActionHandlers {
  return {
    mploc: (button) => {
      context.mpDraft().location = button.dataset.v ?? "";
      return true;
    },
    mpyn: (button) => {
      const field = button.dataset.k;
      if (field !== "alcohol" && field !== "terrace" && field !== "employees" && field !== "delivery")
        return;
      context.mpDraft()[field] = button.dataset.v === "1";
      return true;
    },
    mpsave: () => {
      context.applyMp();
      return true;
    },
    mpreset: () => {
      context.MP = null;
      return true;
    },
    mpwipe: () => {
      context.modal("가게 정보를 처음부터 다시 설정할까요?", {
        kind: "store-reset",
      });
      return true;
    },
    mpwipego: () => {
      context.wipeStore();
      return true;
    },
  };
}
