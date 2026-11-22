import type { DashboardPopulationSnapshot } from "@/types/dashboard-population";

export interface PopulationChartTooltipProps {
  id: string;
  point: DashboardPopulationSnapshot["hourly"][number];
  leftPercent: number;
  barHeight: string;
}

export function PopulationChartTooltip({ id, point, leftPercent, barHeight }: PopulationChartTooltipProps) {
  return (
    <div id={id} role="tooltip"
      className="absolute z-20 w-40 max-w-full -translate-x-1/2 pb-2 text-left text-white"
      style={{ left: `clamp(80px, ${leftPercent}%, calc(100% - 80px))`, bottom: barHeight }}>
      <div className="rounded-lg bg-neutral-900 px-3 py-2">
        <p className="m-0 text-sm leading-5 text-neutral-200">{String(point.hour).padStart(2, "0")}시</p>
        <p className="mb-0 mt-0.5 break-words text-base font-semibold leading-6 tabular-nums">
          {point.value === null ? "공개 수치 없음" : `${Math.round(point.value).toLocaleString("ko-KR")}명`}
        </p>
        {point.value !== null && point.partial && <p className="mb-0 mt-1 text-xs leading-4 text-neutral-300">일부 공개값 합계</p>}
      </div>
    </div>
  );
}
