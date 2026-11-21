"use client";

import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { fmtInt, fmtYmd } from "@/lib/foot-traffic/format";
import type { AsyncData } from "@/types/data-state";
import type { PopulationInsights } from "@/types/population-insights";
import { MarketPanelCard } from "../MarketPanelCard";

export interface PopulationSummaryCardProps {
  data?: AsyncData<PopulationInsights | null>;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function PopulationSummaryCard({ data, loading = false, error = "", onRetry }: PopulationSummaryCardProps) {
  return (
    <MarketPanelCard title="반경 안 생활인구" description="지도에서 선택한 위치를 기준으로 공개 격자를 집계했어요.">
      <DataBoundary
        data={error ? null : data}
        loading={loading}
        onRetry={onRetry}
        fallback={<SectionSkeleton variant="card" rows={3} label="생활인구 요약을 불러오는 중" />}
      >
        {(population) => {
          const measure = population?.total;
          const amount = measure?.value != null ? fmtInt(measure.value)
            : error ? "확인 불가" : measure?.status === "masked" ? "비식별" : "자료 없음";
          const peak = population?.peak;
          return (
            <>
              <div className="rounded-xl bg-foundy-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
                  <span>{population?.hour === "avg" ? "격자별 공개시간 평균 합" : population ? `${String(population.hour).padStart(2, "0")}시 공개값 합` : "공개값"}</span>
                  {measure?.status === "partial" && <span className="rounded-full bg-white px-2 py-0.5 text-xs text-neutral-600">일부 공개</span>}
                </div>
                <p className="mb-0 mt-2 break-words text-[28px] font-bold leading-tight tabular-nums text-foundy-primary">
                  {amount}{measure?.value != null && <span className="ml-1 text-sm font-medium text-foundy-primary-ink">명</span>}
                </p>
              </div>
              {population && <dl className="mb-0 mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-neutral-600">데이터 기준일</dt><dd className="m-0 font-medium text-neutral-700">{fmtYmd(population.sourceDate)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-neutral-600">공개값 있는 격자</dt><dd className="m-0 font-medium tabular-nums text-neutral-700">{measure?.coverage.observedCells ?? 0} / {measure?.coverage.cellCount ?? 0}칸</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-neutral-600">공개값 최대 시간</dt><dd className="m-0 font-medium text-neutral-700">{peak ? `${String(peak.hour).padStart(2, "0")}시` : "비교할 값 없음"}</dd></div>
              </dl>}
              <p className="mb-0 mt-3 text-sm leading-relaxed text-neutral-600">
                생활인구는 결제 고객이나 순방문자 수가 아니에요.{peak?.partial ? " 시간별 공개 범위가 달라 최대 시간도 참고값이에요." : ""}
              </p>
            </>
          );
        }}
      </DataBoundary>
    </MarketPanelCard>
  );
}
