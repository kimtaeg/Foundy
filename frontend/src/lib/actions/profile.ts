import { REGIONS } from "@/data/store";
import { isBooleanProfileField, isEditableProfileField } from "@/lib/profile/editable-fields";
import type { ActionHandlers } from "@/types/actions";
import type { DialogContent } from "@/types/dialog";
import type { ProfileFieldEdit, StoreDraft } from "@/types/profile";

interface ProfileActionContext {
  currentStore(): StoreDraft;
  accountName(): string;
  saveAccountName(name: string): void;
  applyMp(draft: StoreDraft): boolean;
  toast(message: string): void;
  setEdit(edit?: ProfileFieldEdit): void;
  modal(title: string, content: DialogContent): void;
  wipeStore(): void;
}

export function createProfileActions(context: ProfileActionContext) {
  const actions: ActionHandlers = {
    mptoggle: (button) => {
      const { field, answer } = button.dataset;
      if (!isBooleanProfileField(field)) return;
      if (answer !== "true" && answer !== "false") return;
      const draft = context.currentStore();
      const next = answer === "true";
      if (draft[field] !== next) context.applyMp({ ...draft, [field]: next });
      return true;
    },
    mpedit: (button) => {
      const field = button.dataset.field;
      if (!isEditableProfileField(field) || isBooleanProfileField(field)) return;
      const draft = context.currentStore();
      const current = field === "accountName" ? context.accountName() : draft[field];
      const value = String(current ?? "");
      const choices: string[] | undefined = field === "type" ? ["카페", "음식점"] : field === "region" ? REGIONS : undefined;
      context.setEdit({
        field,
        value,
        required: field === "accountName" || field === "opening" || (draft.location === "decided" && (field === "name" || field === "address")),
        options: choices && (choices.includes(value) || !value ? choices : [value, ...choices]),
      });
      return true;
    },
    mpcancel: () => {
      context.setEdit();
      return true;
    },
    mpwipe: () => {
      context.modal("가게 정보를 처음부터 다시 설정할까요?", { kind: "store-reset" });
      return true;
    },
    mpwipego: () => {
      context.wipeStore();
      return true;
    },
  };

  function saveField(edit: ProfileFieldEdit, input: string) {
    const value = input.trim();
    if (edit.required && !value) return;
    if (edit.field === "accountName") {
      context.saveAccountName(value);
      context.setEdit();
      return;
    }
    if (context.applyMp({ ...context.currentStore(), [edit.field]: value })) {
      context.setEdit();
      context.toast("가게 정보를 저장했어요");
    }
  }

  return { actions, saveField };
}
