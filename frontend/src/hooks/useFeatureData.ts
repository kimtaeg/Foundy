"use client";
import { useFoundy } from "@/hooks/useFoundy";
import { type FeatureContextMap, type FeatureContextPage } from "@/types/features";

/** 서버 데이터로 바꾸는 화면. 나머지 화면은 로컬 예시 데이터를 쓴다. */
const API_PAGES = ["dashboard", "report", "checklist", "docs", "grants"] as const;
type ApiPage = (typeof API_PAGES)[number];
const isApiPage = (page: string): page is ApiPage => (API_PAGES as readonly string[]).includes(page);

/** The page key determines the feature contract; callers cannot cast another model. */
export function useFeatureData<Page extends FeatureContextPage>(page: Page) {
  const state = useFoundy();
  const local = state.engine?.getViewContext(page) ?? null;
  if (!local || !isApiPage(page)) return { ...state, context: local };
  if (state.apiPending) return { ...state, context: null };
  if (!state.api) return { ...state, context: local };
  // 화면 상태(필터·보기·달력)는 로컬 값을 두고 데이터만 서버 응답으로 바꾼다.
  const context = { ...local, ...state.api[page] } as FeatureContextMap[Page];
  return { ...state, context };
}
