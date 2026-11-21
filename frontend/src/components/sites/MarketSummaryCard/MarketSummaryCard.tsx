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
    <MarketPanelCard title="반경 안 점포 구성" description="현재 중심·반경·업종에 포함된 예시 점포를 모았어요.">
      {analysis.count ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-foundy-primary/5 p-3">
              <p className="mb-1 mt-0 text-sm text-neutral-600">표시된 예시 점포</p>
              <strong className="text-2xl font-bold tabular-nums text-foundy-primary">
                {analysis.count}<span className="ml-1 text-sm font-normal text-foundy-primary-ink">곳</span>
              </strong>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="mb-1 mt-0 text-sm text-neutral-600">표본 밀집도</p>
              <strong className="text-2xl font-bold tabular-nums text-neutral-800">
                {analysis.density}<span className="ml-1 text-xs font-normal">곳/㎢</span>
              </strong>
            </div>
          </div>
          <DonutChart title="표본의 업종 비중" rows={categories} unit="곳" centerLabel="예시 점포" />
          <div className="border-0 border-t border-solid border-neutral-100 pt-4">
            <HorizontalBarChart title="세부 업종 상위 5개" rows={analysis.composition.slice(0, 5).map((row) => ({ label: row.label, value: row.value, detail: `${row.percent.toFixed(1)}%` }))} unit="곳" />
            {analysis.composition.length > 5 && <p className="mb-0 mt-2 text-sm text-neutral-600">총 {analysis.composition.length}개 분류 중 점포 수가 많은 5개를 표시해요.</p>}
          </div>
          <p className="m-0 rounded-xl bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-600">
            성수역 주변 예시 좌표 기준입니다. 전체 점포 통계가 아니므로 실제 상권 점유율이나 경쟁 강도로 해석하지 않아요.
          </p>
        </div>
      ) : <MarketEmptyState />}
    </MarketPanelCard>
  );
}
