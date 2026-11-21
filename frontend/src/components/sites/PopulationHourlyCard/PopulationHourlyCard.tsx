import { HourlyPopulationChart } from "@/components/charts/HourlyPopulationChart";
import type { HourSel } from "@/types/foot-traffic";
import type { PopulationHourlyPoint } from "@/types/population-insights";
import { MarketPanelCard } from "../MarketPanelCard";

export interface PopulationHourlyCardProps {
  points: readonly PopulationHourlyPoint[];
  hour: HourSel;
  onHourChange: (hour: HourSel) => void;
}

const statusLabel = { public: "공개값", partial: "일부 공개", masked: "비식별", missing: "자료 없음" };

export function PopulationHourlyCard({ points, hour, onHourChange }: PopulationHourlyCardProps) {
  return (
    <MarketPanelCard title="시간대별 생활인구" description="같은 기준일의 24시간 공개값 흐름입니다.">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="population-chart-hour" className="text-sm font-medium text-neutral-600">지도·구성 분석 시간</label>
        <select
          id="population-chart-hour"
          aria-label="그래프에서 분석 시간 선택"
          value={hour}
          onChange={(event) => onHourChange(event.target.value === "avg" ? "avg" : Number(event.target.value))}
          className="min-h-11 max-w-full rounded-lg border border-solid border-neutral-200 bg-white px-3 text-base text-neutral-800 focus:outline-foundy-primary"
        >
          <option value="avg">공개시간 평균</option>
          {points.map((point) => <option key={point.hour} value={point.hour}>{point.label}</option>)}
        </select>
      </div>
      <HourlyPopulationChart
        points={points.map((point) => ({ hour: point.hour, value: point.total.value, detail: statusLabel[point.total.status] }))}
        selectedHour={hour}
        onSelectHour={onHourChange}
      />
    </MarketPanelCard>
  );
}
