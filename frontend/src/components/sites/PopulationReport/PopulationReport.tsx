"use client";

import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { AsyncData } from "@/types/data-state";
import type { HourSel } from "@/types/foot-traffic";
import type { PopulationInsights } from "@/types/population-insights";
import { MarketPanelCard } from "../MarketPanelCard";
import { PopulationBreakdownCard } from "../PopulationBreakdownCard";
import { PopulationDataNote } from "../PopulationDataNote";
import { PopulationHourlyCard } from "../PopulationHourlyCard";
import { PopulationSummaryCard } from "../PopulationSummaryCard";

export interface PopulationReportProps {
  data?: AsyncData<PopulationInsights | null>;
  loading?: boolean;
  error?: string;
  retry?: () => void;
  hour: HourSel;
  onHourChange: (hour: HourSel) => void;
}

export function PopulationReport({ data, loading = false, error = "", retry, hour, onHourChange }: PopulationReportProps) {
  return (
    <div className="divide-x-0 divide-y divide-solid divide-neutral-200 [&>*]:py-6 [&>:first-child]:pt-0 [&>:last-child]:pb-0 [&>:last-child]:pt-2" data-testid="population-report">
      <PopulationSummaryCard data={data} loading={loading} error={error} onRetry={retry} />
      {error ? (
        <div role="alert" className="text-sm leading-relaxed text-neutral-600">
          <p className="m-0">{error}</p>
          {retry && <button type="button" onClick={retry} className="mt-3 min-h-10 rounded-lg border-0 bg-foundy-primary px-4 font-medium text-white">그래프 다시 시도</button>}
        </div>
      ) : (
        <DataBoundary
          data={data}
          loading={loading}
          onRetry={retry}
          fallback={
            <div className="divide-x-0 divide-y divide-solid divide-neutral-200 [&>*]:py-6 [&>:first-child]:pt-0 [&>:last-child]:pb-0">
              {["시간대별 생활인구", "생활인구 구성", "내국인 성별 구성", "내국인 연령별 구성"].map((title) => (
                <MarketPanelCard key={title} title={title}>
                  <SectionSkeleton variant="chart" appearance="plain" label={`${title}를 불러오는 중`} />
                </MarketPanelCard>
              ))}
            </div>
          }
        >
          {(population) => population && (
            <>
              <PopulationHourlyCard points={population.hourly} hour={hour} onHourChange={onHourChange} />
              <PopulationBreakdownCard title="생활인구 구성" description="내국인·장기외국인·단기외국인의 공개값을 비교해요." rows={population.types} chart="donut" />
              <PopulationBreakdownCard title="내국인 성별 구성" description="같은 반경·시간의 내국인 공개값 기준입니다." rows={population.sex} chart="donut" />
              <PopulationBreakdownCard title="내국인 연령별 구성" description="연령별 공개값을 따로 비교하며, 성별과 결합하지 않아요." rows={population.age} chart="bar" />
              <PopulationDataNote date={population.sourceDate} />
            </>
          )}
        </DataBoundary>
      )}
    </div>
  );
}
