import { DonutChart, HorizontalBarChart } from "@/components/charts";
import { MarketMetric } from "@/components/sites/MarketMetric";
import { MarketPanelCard } from "@/components/sites/MarketPanelCard";
import type { MarketAnalysis } from "@/types/market";

export interface CompetitionCardProps { analysis: MarketAnalysis }

export function CompetitionCard({ analysis }: CompetitionCardProps) {
  if (!analysis.count) return null;
  return (
    <MarketPanelCard title="거리와 점포 특성" description="지도에 표시된 점포를 거리와 브랜드별로 살펴봐요.">
      <div className="space-y-5">
        <div>
          <HorizontalBarChart title="거리별 누적 점포 수" rows={analysis.distanceRows} unit="곳" maxValue={analysis.count} />
        </div>
        <div className="border-0 border-t border-solid border-neutral-100 pt-4">
          <DonutChart title="브랜드 이름 기준 분류" rows={[
            { label: "프랜차이즈 추정", value: analysis.franchiseCount },
            { label: "그 외 점포", value: analysis.independentCount },
          ]} unit="곳" centerLabel="점포" />
        </div>
        <div className="-mt-4">
          <MarketMetric label="디저트·베이커리 분류">{analysis.dessertCount}곳</MarketMetric>
        </div>
      </div>
    </MarketPanelCard>
  );
}
