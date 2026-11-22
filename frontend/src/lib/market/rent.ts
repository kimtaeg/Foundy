import { createStoreApi, loadSession } from "@/lib/api/foundy-api";
import type { ApiRent, ApiRentHeadline, ApiRentQuery, ApiRentRow } from "@/lib/api/types";

/** 현재 로그인한 가게의 임대료 비교 (서버가 한국부동산원 통계를 조회·계산한다). */
export function loadRentComparison(query: ApiRentQuery = {}): Promise<ApiRent> {
  const session = loadSession();
  if (!session?.storeId) return Promise.reject(new Error("가게가 아직 등록되지 않았어요"));
  return createStoreApi(session).rent(query);
}

/** 3.3㎡(1평) = 3.3058㎡ */
const PYEONG_SQM = 3.3058;

/** 원 → 만원 (반올림 정수). 예: 2,695,240 → 270 */
export const toManwon = (krw: number) => Math.round(krw / 10_000);

/** 입력칸의 만원 값 → 원. 빈칸이면 undefined */
export const manwonInputToKrw = (value: string) =>
  value.trim() === "" ? undefined : Math.round(Number(value) * 10_000);

/** ㎡당 원 → 3.3㎡당 만원 (소수 1자리). 예: 67,381 → 22.3 */
export const perPyeongManwon = (krwPerSqm: number) =>
  Math.round((krwPerSqm * PYEONG_SQM) / 1_000) / 10;

const LEVEL_TEXT = { high: "높아요", low: "낮아요", similar: "비슷해요" } as const;
const signed = (pct: number) => `${pct > 0 ? "+" : ""}${pct}%`;

/** 평균 대비 짧은 표시 (예: "-1.2% · 비슷해요"). 비교 결과가 없으면 null */
export function rentDiffShort(result: ApiRent): string | null {
  const c = result.comparison;
  if (!c || c.level === null || c.diff_pct === null) return null;
  return `${signed(c.diff_pct)} · ${LEVEL_TEXT[c.level]}`;
}

/** 평균과의 차이 문장 (예: "상권 1층 평균보다 18% 높아요"). 옛 응답에서 "이 숫자 읽는 법" 대신 쓴다 */
export function rentDiffText(result: ApiRent): string | null {
  const c = result.comparison;
  const scope = result.headline?.area_level ?? result.average?.level;
  if (!c || c.level === null || c.diff_pct === null || !scope) return null;
  const floor = c.compared_floor ?? result.headline?.floor_label;
  const target = floor ? `${scope} ${floor}` : scope;
  if (c.level === "similar") return `${target} 평균과 비슷해요 (${signed(c.diff_pct)})`;
  return `${target} 평균보다 ${Math.abs(c.diff_pct)}% ${LEVEL_TEXT[c.level]}`;
}

/** 부제에 쓸 범위 이름 (예: "뚝섬 상권", "도심 권역", "서울") */
export function rentScopeName(headline: Pick<ApiRentHeadline, "area_name" | "area_level">): string {
  const name = headline.area_name.split(">").pop() ?? headline.area_name;
  return headline.area_level === "시도" ? name : `${name} ${headline.area_level}`;
}

export interface RentView {
  headline: ApiRentHeadline;
  rows: ApiRentRow[] | null;
  readings: string[];
  source: { name: string; period: string };
}

/**
 * 화면에 그릴 값을 모은다. 새 응답은 headline·rows·readings·source 를 그대로 쓰고,
 * 옛 응답(average·comparison 만)은 지역 평균으로 최소한만 채운다. 통계가 없으면 null (지어낸 숫자 없음).
 */
export function rentView(result: ApiRent): RentView | null {
  if (result.status === "unavailable") return null;
  const average = result.average;
  const area = result.inputs.area_sqm;
  const headline: ApiRentHeadline | null = result.headline ?? (average ? {
    area_name: average.area_name,
    area_level: average.level,
    building_type: average.building_type,
    floor_label: result.basis.floor.replace(/\s*기준$/, "") || "1층",
    krw_per_sqm: average.krw_per_sqm,
    monthly_for_my_area_krw: area ? Math.round(average.krw_per_sqm * area) : null,
    statistic: "평균",
  } : null);
  const source = result.source ?? (average ? { name: average.source, period: average.period } : null);
  if (!headline || !source) return null;
  const diff = rentDiffText({ ...result, headline });
  const readings = result.readings ?? (diff ? [diff] : []);
  return { headline, rows: result.rows?.length ? result.rows : null, readings, source };
}
