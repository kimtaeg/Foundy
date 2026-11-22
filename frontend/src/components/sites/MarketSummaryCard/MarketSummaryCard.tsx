import { DonutChart, HorizontalBarChart } from "@/components/charts";
import { MarketEmptyState } from "@/components/sites/MarketEmptyState";
import { MarketPanelCard } from "@/components/sites/MarketPanelCard";
import type { MarketAnalysis } from "@/types/market";

export interface MarketSummaryCardProps { analysis: MarketAnalysis }

export function MarketSummaryCard({ analysis }: MarketSummaryCardProps) {
  const categories = [...new Set(analysis.nearby.map((shop) => shop.cat))].map((label) => ({
    label,
    value: analysis.nearby.filter((shop) => shop.cat === label).length,
  }));
  return (
    <MarketPanelCard title="반경 안 점포 구성" description="카카오 지도에서 찾은 반경 안 카페·음식점을 업종별로 집계해요.">
      {analysis.count ? (
        <div className="space-y-5">
          <dl className="m-0 grid grid-cols-2 gap-4 mb-4">
            <div>
              <dt className="text-sm font-medium text-neutral-600">표시된 점포</dt>
              <dd className="m-0 mt-1 text-3xl font-semibold tracking-tight text-neutral-900 tabular-nums">
                {analysis.count}<span className="ml-1 text-sm font-medium text-neutral-600">곳</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-600">표시된 점포 밀도</dt>
              <dd className="m-0 mt-1 text-3xl font-semibold tracking-tight text-neutral-900 tabular-nums">
                {analysis.density}<span className="ml-1 text-sm font-medium text-neutral-600">곳/㎢</span>
              </dd>
            </div>
          </dl>
          <DonutChart title="표시된 점포의 업종 비중" rows={categories} unit="곳" centerLabel="점포" />
          <div className="border-0 border-t border-solid border-neutral-100 pt-4">
            <HorizontalBarChart title="세부 업종 상위 5개" rows={analysis.composition.slice(0, 5).map((row) => ({ label: row.label, value: row.value, detail: `${row.percent.toFixed(1)}%` }))} unit="곳" />
            {analysis.composition.length > 5 && <p className="mb-0 mt-2 text-sm text-neutral-600">총 {analysis.composition.length}개 분류 중 점포 수가 많은 5개를 표시해요.</p>}
          </div>
        </div>
      ) : <MarketEmptyState status={analysis.status} />}
    </MarketPanelCard>
  );
}
