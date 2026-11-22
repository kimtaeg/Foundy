import { type ActionHandlers } from "@/types/actions";

interface NavigationActionContext {
  goto(page: string): void;
  setTimeout(callback: () => void, delay?: number): unknown;
  $(id: string): HTMLElement | null;
}

/** Commands emitted by navigation views; view layout is deliberately absent. */
export function createNavigationActions(
  context: NavigationActionContext,
): ActionHandlers {
  return {
    go: (b: HTMLElement) => {
      context.goto(b.dataset.p!);
      if (b.dataset.focus)
        context.setTimeout(() => {
          const el = context.$("result-" + b.dataset.focus);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);

      return true;
    },
    godocs: (b: HTMLElement) => {
      context.goto("docs");
      const target = b.dataset.tid;
      if (target)
        context.setTimeout(() => {
          context
            .$("doc-" + target)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);

      return true;
    },
    cnav: (b: HTMLElement) => {
      context.goto(b.dataset.p!);
      const fc = b.dataset.focus;
      if (fc)
        context.setTimeout(() => {
          const el = context.$("result-" + fc);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);

      return true;
    },
  };
}
