import { type ActionHandlers } from "@/types/actions";

interface DocumentsActionContext {
  copyText(text: string): void;
}

export function createDocumentsActions(
  context: DocumentsActionContext,
): ActionHandlers {
  return {
    copyphone: (button) => {
      context.copyText(button.dataset.phone ?? "");
      return true;
    },
  };
}
