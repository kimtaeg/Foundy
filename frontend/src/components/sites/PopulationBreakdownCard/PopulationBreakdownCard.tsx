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
const sexColors = new Map([["male", "#3b82f6"], ["female", "#ef4444"]]);

export function PopulationBreakdownCard({ title, description, rows, chart }: PopulationBreakdownCardProps) {
  const chartRows = rows.map((row) => ({
    label: row.label,
    color: sexColors.get(row.key),
    value: row.value,
    unavailableLabel: statusLabel[row.status],
    detail: row.share === null ? undefined : `${row.share.toFixed(1)}% · ${statusLabel[row.status]}`,
  }));
  return (
    <MarketPanelCard title={title} description={description}>
      {chart === "donut"
        ? <DonutChart title="공개값 구성비" rows={chartRows} unit="명" centerLabel="공개값 합" formatValue={fmtInt} showPercent />
        : <HorizontalBarChart title="연령별 공개값" rows={chartRows} unit="명" formatValue={fmtInt} />}
    </MarketPanelCard>
  );
}
