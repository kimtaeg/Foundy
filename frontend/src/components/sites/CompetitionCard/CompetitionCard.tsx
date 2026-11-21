import { DonutChart, HorizontalBarChart } from "@/components/charts";
import { MarketMetric } from "@/components/sites/MarketMetric";
import { MarketPanelCard } from "@/components/sites/MarketPanelCard";
import type { MarketAnalysis } from "@/types/market";

export interface CompetitionCardProps { analysis: MarketAnalysis }

export function CompetitionCard({ analysis }: CompetitionCardProps) {
  if (!analysis.count) return null;
  const noun = analysis.example ? "예시 점포" : "점포";
  return (
    <MarketPanelCard title="거리와 점포 특성" description={`선택한 업종의 ${analysis.example ? "예시 표본" : "조회 결과"}를 거리와 브랜드로 살펴봐요.`}>
      <div className="space-y-5">
        <div>
          <HorizontalBarChart title="거리별 누적 점포 수" rows={analysis.distanceRows} unit="곳" maxValue={analysis.count} />
          <p className="mb-0 mt-2 text-sm leading-relaxed text-neutral-600">가까운 점포를 포함하는 누적값이에요. 거리별 수를 합산하지 않아요.</p>
        </div>
        <div className="border-0 border-t border-solid border-neutral-100 pt-4">
          <DonutChart title="브랜드 이름 기준 분류" rows={[
            { label: "프랜차이즈 추정", value: analysis.franchiseCount },
            { label: `그 외 ${noun}`, value: analysis.independentCount },
          ]} unit="곳" centerLabel={noun} />
        </div>
        <div className="rounded-xl bg-neutral-50 px-3 py-1">
          <MarketMetric label="디저트·베이커리 분류">{analysis.dessertCount}곳</MarketMetric>
        </div>
        <p className="m-0 text-sm leading-relaxed text-neutral-600">브랜드·업종명 규칙에 따른 분류이며 실제 가맹 여부와 다를 수 있어요.</p>
      </div>
    </MarketPanelCard>
  );
}
