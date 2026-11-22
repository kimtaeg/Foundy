"use client";

import { useId, useState } from "react";
import { PopulationChartTooltip } from "@/components/dashboard/PopulationChartTooltip";
import type { DashboardPopulationSnapshot } from "@/types/dashboard-population";

export interface PopulationPreviewChartProps {
  points: DashboardPopulationSnapshot["hourly"];
  selectedHour: number | null;
  onSelectHour: (hour: number) => void;
}

export function PopulationPreviewChart({ points, selectedHour, onSelectHour }: PopulationPreviewChartProps) {
  const tooltipId = useId();
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [focusedHour, setFocusedHour] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const maximum = Math.max(1, ...points.map((point) => point.value ?? 0));
  const bars = points.map((point) => {
    const intensity = Math.max(0, Math.min(1, (point.value ?? 0) / maximum));
    return {
      point,
      height: point.value === null ? "4px" : `${Math.max(2, intensity * 100)}%`,
      color: `color-mix(in srgb, var(--color-foundy-primary) ${15 + intensity * 85}%, white)`,
    };
  });
  const tooltipIndex = dismissed ? -1 : bars.findIndex(({ point }) => point.hour === (hoveredHour ?? focusedHour));
  const tooltip = bars[tooltipIndex];
  return (
    <div role="group" aria-label="시간대별 공개 생활인구" className="mt-5"
      onMouseLeave={() => setHoveredHour(null)}
      onKeyDown={(event) => { if (event.key === "Escape") setDismissed(true); }}>
      <div className="relative h-32 border-0 border-b border-solid border-neutral-200">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-8">
          {[0, 1, 2].map((line) => <div key={line} className="border-0 border-t border-dashed border-neutral-200/70" />)}
        </div>
        <div className="relative grid h-full grid-cols-24 items-end gap-[3px]">
          {bars.map(({ point, height, color }) => {
            const selected = point.hour === selectedHour;
            const label = point.value === null ? "공개 수치 없음" : `${Math.round(point.value).toLocaleString("ko-KR")}명${point.partial ? ", 일부 공개" : ""}`;
            return (
              <button
                key={point.hour}
                type="button"
                aria-label={`${point.hour}시, ${label}`}
                aria-pressed={selected}
                aria-describedby={tooltip?.point.hour === point.hour ? tooltipId : undefined}
                onClick={() => onSelectHour(point.hour)}
                onFocus={(event) => {
                  if (event.currentTarget.matches(":focus-visible")) {
                    setFocusedHour(point.hour);
                    setHoveredHour(null);
                    setDismissed(false);
                  }
                  onSelectHour(point.hour);
                }}
                onBlur={() => setFocusedHour(null)}
                onMouseEnter={() => {
                  setHoveredHour(point.hour);
                  setDismissed(false);
                  onSelectHour(point.hour);
                }}
                className="group flex h-full min-w-0 cursor-pointer items-end border-0 bg-transparent p-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary"
              >
                <span
                  aria-hidden="true"
                  className={`block w-full rounded-t-sm transition-colors motion-reduce:transition-none ${point.value === null ? "border border-dashed border-neutral-500" : selected ? "outline outline-1 -outline-offset-1 outline-foundy-primary-ink" : ""}`}
                  style={{
                    height,
                    backgroundColor: point.value === null ? undefined : color,
                  }}
                />
              </button>
            );
          })}
        </div>
        {tooltip && <PopulationChartTooltip id={tooltipId} point={tooltip.point}
          leftPercent={(tooltipIndex + 0.5) / points.length * 100} barHeight={tooltip.height} />}
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-between text-xs tabular-nums text-neutral-600">
        <span>00시</span><span>06시</span><span>12시</span><span>18시</span><span>23시</span>
      </div>
    </div>
  );
}
