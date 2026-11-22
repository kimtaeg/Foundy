import { createStoreApi, loadSession } from "@/lib/api/foundy-api";
import type { ApiRent, ApiRentQuery } from "@/lib/api/types";

/** 현재 로그인한 가게의 임대료 비교 (서버가 한국부동산원 통계를 조회·계산한다). */
export function loadRentComparison(query: ApiRentQuery = {}): Promise<ApiRent> {
  const session = loadSession();
  if (!session?.storeId) return Promise.reject(new Error("가게가 아직 등록되지 않았어요"));
  return createStoreApi(session).rent(query);
}

const LEVEL_TEXT = { high: "높아요", low: "낮아요", similar: "비슷해요" } as const;

/** 평균과의 차이 문장 (예: "상권 평균보다 18% 높아요"). 비교 결과가 없으면 null */
export function rentDiffText(result: ApiRent): string | null {
  const c = result.comparison;
  if (!c || c.level === null || c.diff_pct === null || !result.average) return null;
  const scope = result.average.level;
  if (c.level === "similar") return `${scope} 평균과 비슷해요 (${c.diff_pct > 0 ? "+" : ""}${c.diff_pct}%)`;
  return `${scope} 평균보다 ${Math.abs(c.diff_pct)}% ${LEVEL_TEXT[c.level]}`;
}
