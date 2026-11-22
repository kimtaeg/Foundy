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
    <MarketPanelCard title="반경 안 생활인구">
      <DataBoundary
        data={error ? null : data}
        loading={loading}
        onRetry={onRetry}
        fallback={<SectionSkeleton variant="card" appearance="plain" rows={3} label="생활인구 요약을 불러오는 중" />}
      >
        {(population) => {
          const measure = population?.total;
          const amount = measure?.value != null ? fmtInt(measure.value)
            : error ? "확인 불가" : measure?.status === "masked" ? "비식별" : "자료 없음";
          const peak = population?.peak;
          return (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-neutral-600">{population?.hour === "avg" ? "격자별 공개시간 평균 합" : population ? `${String(population.hour).padStart(2, "0")}시 공개값 합` : "공개값"}</span>
                {measure?.status === "partial" && <span className="rounded-full bg-foundy-primary/10 px-2 py-0.5 text-xs font-medium text-foundy-primary-ink">일부 공개</span>}
              </div>
              <p className="mb-0 mt-1 break-words text-4xl font-semibold leading-tight tracking-tight text-neutral-900 tabular-nums">
                {amount}{measure?.value != null && <span className="ml-1.5 text-base font-medium text-neutral-600">명</span>}
              </p>
              {population && (
                <>
                  <dl className="mb-0 mt-5 grid grid-cols-2 gap-x-4">
                    <div>
                      <dt className="text-sm text-neutral-600">공개값 최대 시간</dt>
                      <dd className="m-0 mt-1 text-lg font-semibold text-foundy-primary-ink tabular-nums">{peak ? `${String(peak.hour).padStart(2, "0")}시` : "비교할 값 없음"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-neutral-600">공개값 있는 격자</dt>
                      <dd className="m-0 mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
                        {population.total.coverage.observedCells}<span className="text-sm font-medium text-neutral-600"> / {population.total.coverage.cellCount}칸</span>
                      </dd>
                    </div>
                  </dl>
                  <p className="mb-0 mt-4 text-xs leading-relaxed text-neutral-600">데이터 기준일 · <time dateTime={fmtYmd(population.sourceDate)}>{fmtYmd(population.sourceDate)}</time></p>
                </>
              )}
            </>
          );
        }}
      </DataBoundary>
    </MarketPanelCard>
  );
}
