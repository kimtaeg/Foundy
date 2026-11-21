"use client";

import { Suspense } from "react";
import { LEVEL_META, POPULATION_LEVELS, POPULATION_SCALE_LABELS, fmtInt, fmtYmd, type Category, type HourSel, type PopulationCuts, type Quality } from "@/lib/foot-traffic";

export interface PopulationLegendProps {
  category: Category;
  label: string;
  hour: HourSel;
  date: string;
  radius: number;
  cuts: PopulationCuts;
  summary: { sum: number; total: number; observed: number; suppressed: number } | null;
  quality: Quality | null;
  loading: boolean;
  hasPublicValues: boolean;
  settingsOpen: boolean;
}

export function PopulationLegend({ category, label, hour, date, radius, cuts, summary, quality, loading, hasPublicValues, settingsOpen }: PopulationLegendProps) {
  const value = !summary ? "데이터 확인 불가" : !summary.total ? "공개 자료 없음" : !summary.observed ? "비식별 · 숫자 없음" : `${fmtInt(summary.sum)}명`;
  const totalSkeleton = (
    <span role="status" aria-label="생활인구 합계를 불러오는 중" className="inline-block h-6 w-20 rounded-md bg-neutral-200 motion-safe:animate-pulse" />
  );
  return (
    <section aria-label="생활인구 범례와 데이터 기준" className={`${settingsOpen ? "hidden lg:block" : "block"} absolute bottom-14 left-3 z-10 max-h-[45%] w-[min(300px,calc(100%-1.5rem))] overflow-y-auto rounded-2xl border border-solid border-neutral-200 bg-white p-4 lg:left-4 lg:max-h-[calc(40%-3.5rem)]`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-base font-bold text-neutral-800">생활인구 · {label}</h3>
        <span className="text-xs text-neutral-600">{hour === "avg" ? "공개시간 평균" : `${String(hour).padStart(2, "0")}시`}</span>
      </div>
      <p className="mb-1.5 mt-3 text-xs font-medium text-neutral-700">250m 격자 · {POPULATION_SCALE_LABELS[category]}</p>
      <div className="grid h-2 grid-cols-5 gap-1 overflow-hidden rounded-full" aria-hidden="true">
        {POPULATION_LEVELS.map((level) => <span key={level} style={{ backgroundColor: LEVEL_META[level].color }} />)}
      </div>
      {!loading && hasPublicValues && (
        <dl className="mb-0 mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs leading-relaxed tabular-nums text-neutral-600">
          {POPULATION_LEVELS.map((level, index) => (
            <div key={level}>
              <dt className="flex items-center gap-1.5 font-semibold text-neutral-700">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: LEVEL_META[level].color }} />
                {LEVEL_META[level].label}
              </dt>
              <dd className="m-0">
                {index === 0 ? `${fmtInt(cuts[0])}명 미만` : index === cuts.length ? `${fmtInt(cuts[index - 1])}명 이상` : `${fmtInt(cuts[index - 1])}~${fmtInt(cuts[index])}명 미만`}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2">
        <span className="text-xs leading-relaxed text-neutral-600">반경 {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`} 공개값<br />{hour === "avg" ? "격자별 공개시간 평균 합" : "격자 공개값 합계"}</span>
        <Suspense fallback={totalSkeleton}>
          {loading ? totalSkeleton : <b className="text-base tabular-nums text-neutral-900">{value}</b>}
        </Suspense>
      </div>
      <details className="mt-2 text-xs leading-relaxed text-neutral-600">
        <summary className="cursor-pointer">
          {loading ? (
            <span aria-label="데이터 기준일을 불러오는 중" className="mr-1 inline-block h-3 w-20 rounded bg-neutral-200 align-middle motion-safe:animate-pulse" />
          ) : date ? `${fmtYmd(date)} 기준 · ` : ""}
          출처와 표시 기준
        </summary>
        <div className="mt-2 space-y-2 text-sm">
          <p className="m-0">도로별 실측 보행량이 아닌, 도로가 지나는 250m 격자의 생활인구 추정치입니다.</p>
          <p className="m-0">{cuts.map(fmtInt).join("·")}명을 경계로 나눈 {POPULATION_LEVELS.length}단계 서비스 표시 기준입니다. 각 구간의 시작 인원수는 포함하며, 공식 혼잡·안전 등급은 아닙니다.</p>
          <p className="m-0">전체·성별·연령대는 인구 규모에 맞춰 별도 기준을 사용합니다. 남녀끼리, 모든 연령대끼리는 각각 같은 기준으로 비교하며 시간·위치·반경에 따라 기준을 다시 계산하지 않습니다.</p>
          <p className="m-0">지도 도로의 색은 인원수에 따라 연속적으로 바뀌며 연결 지점은 시각적으로 보간합니다. 툴팁과 합계는 원래 격자의 공개값을 유지합니다. 회색은 비식별이며 원본 행이 없는 도로는 표시하지 않습니다.</p>
          {hour === "avg" && <p className="m-0">격자별로 공개값이 있는 시간만 평균에 포함합니다. 공개시간 수가 달라 24시간 전체 평균이나 완전한 총인구가 아닙니다.</p>}
          {!loading && summary && <p className="m-0">격자 중심이 반경에 포함된 {summary.total}칸 중 공개값 {summary.observed}칸 · 비식별 포함 {summary.suppressed}칸. 비식별은 0으로 대체하지 않습니다.</p>}
          {!loading && quality && <p className="m-0">생성 {new Date(quality.builtAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" })}</p>}
          <p className="m-0">출처: 서울특별시·KT, 서울시 통신데이터<br />도로: © OpenStreetMap contributors · ODbL</p>
        </div>
      </details>
    </section>
  );
}
