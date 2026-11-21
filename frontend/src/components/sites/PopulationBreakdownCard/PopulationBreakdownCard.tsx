import { DonutChart, HorizontalBarChart } from "@/components/charts";
import { fmtInt } from "@/lib/foot-traffic/format";
import type { PopulationBreakdownRow } from "@/types/population-insights";
import { MarketPanelCard } from "../MarketPanelCard";

export interface PopulationBreakdownCardProps {
  title: string;
  description: string;
  rows: readonly PopulationBreakdownRow[];
  chart: "donut" | "bar";
}

const statusLabel = { public: "공개값", partial: "일부 공개", masked: "비식별", missing: "자료 없음" };

export function PopulationBreakdownCard({ title, description, rows, chart }: PopulationBreakdownCardProps) {
  const chartRows = rows.map((row) => ({
    label: row.label,
    value: row.value,
    unavailableLabel: statusLabel[row.status],
    detail: row.share === null ? undefined : `${row.share.toFixed(1)}% · ${statusLabel[row.status]}`,
  }));
  const incomplete = rows.some((row) => row.status !== "public");
  return (
    <MarketPanelCard title={title} description={description}>
      {chart === "donut"
        ? <DonutChart title="공개값 구성비" rows={chartRows} unit="명" centerLabel="공개값 합" formatValue={fmtInt} showPercent />
        : <HorizontalBarChart title="연령별 공개값" rows={chartRows} unit="명" formatValue={fmtInt} />}
      <p className="mb-0 mt-3 text-sm leading-relaxed text-neutral-600">
        표시된 공개값 안에서 계산한 비중이에요.{incomplete ? " 비식별·미제공 값이 있어 전체 인구의 정확한 구성비와 다를 수 있어요." : ""}
      </p>
    </MarketPanelCard>
  );
}
