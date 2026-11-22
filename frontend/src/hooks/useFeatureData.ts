"use client";
import { useFoundy } from "@/hooks/useFoundy";
import { type FeatureContextMap, type FeatureContextPage } from "@/types/features";

export function useFeatureData<Page extends FeatureContextPage>(page: Page) {
  const state = useFoundy();
  if (state.apiActive && (page === "dashboard" || page === "docs")) return { ...state, context: null };
  if (state.apiActive && (page === "report" || page === "checklist")) {
    const server = page === "report" ? state.api?.report : state.api?.checklist;
    const local = server && state.engine?.getViewContext(page);
    // Only the filter, view mode and calendar position come from the client in API mode.
    const context = local ? { ...local, ...server } as FeatureContextMap[Page] : null;
    return { ...state, context };
  }
  const local = state.engine?.getViewContext(page) ?? null;
  return { ...state, context: local };
}
