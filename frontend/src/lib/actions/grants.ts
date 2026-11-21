import { type ActionHandlers } from "@/types/actions";
import { type GrantFilters } from "@/types/grants";

interface GrantsActionContext {
  G: GrantFilters;
  grantModal(grantId: string): void;
}

/** Commands emitted by grants views; view layout is deliberately absent. */
export function createGrantsActions(
  context: GrantsActionContext,
): ActionHandlers {
  return {
    gf: (b: HTMLElement) => {
      const v = b.dataset.v ?? "";

      Object.assign(context.G, { [b.dataset.k ?? ""]: v });

      return true;
    },
    gdetail: (b: HTMLElement) => {
      const id = b.dataset.id ?? "";

      context.grantModal(id);
      return true;
    },
  };
}
