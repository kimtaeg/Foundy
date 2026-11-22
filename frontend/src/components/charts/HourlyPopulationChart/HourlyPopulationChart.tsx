"use client";

import { useId, useState } from "react";
import { PopulationChartTooltip } from "@/components/dashboard/PopulationChartTooltip";
import { fmtInt } from "@/lib/foot-traffic/format";
import type { HourSel } from "@/types/foot-traffic";

interface Point {
  hour: number;
  value: number | null;
  detail: string;
  partial?: boolean;
}

export interface HourlyPopulationChartProps {
  points: readonly Point[];
  selectedHour: HourSel;
  onSelectHour: (hour: number) => void;
}

export function HourlyPopulationChart({ points, selectedHour, onSelectHour }: HourlyPopulationChartProps) {
  const tooltipId = useId();
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [focusedHour, setFocusedHour] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const hasValues = points.some((point) => point.value !== null);
  const peak = Math.max(0, ...points.map((point) => point.value ?? 0));
  const bars = points.map((point) => {
    const ratio = peak && point.value !== null ? point.value / peak : 0;
    return {
      point,
      height: point.value === null ? "4px" : `${Math.max(2, ratio * 100)}%`,
      color: `color-mix(in srgb, var(--color-foundy-primary) ${15 + ratio * 85}%, white)`,
    };
  });
  const previewIndex = dismissed ? -1 : bars.findIndex(({ point }) => point.hour === (hoveredHour ?? focusedHour));
  const preview = bars[previewIndex];

  return (
    <figure className="m-0" aria-label="24시간 공개 생활인구 막대그래프"
      onMouseLeave={() => setHoveredHour(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && preview) {
          event.stopPropagation();
          setDismissed(true);
        }
      }}>
      <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs tabular-nums text-neutral-600">
        <span>공개값 · 명</span>
        <span>{preview?.point.value === null ? preview.point.detail : hasValues ? `최대 ${fmtInt(peak)}명` : "공개 수치 없음"}</span>
      </div>
      <div className="relative h-32 border-0 border-b border-solid border-neutral-200">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-8">
          {[0, 1, 2].map((line) => <div key={line} className="border-0 border-t border-dashed border-neutral-200/70" />)}
        </div>
        <div className="relative grid h-full grid-cols-24 items-end gap-0.5">
          {bars.map(({ point, height, color }) => {
            const hourLabel = `${String(point.hour).padStart(2, "0")}시`;
            const valueLabel = point.value === null ? point.detail : `${fmtInt(point.value)}명 · ${point.detail}`;
            const selected = selectedHour === point.hour;
            return (
              <button
                key={point.hour}
                type="button"
                aria-label={`${hourLabel} 생활인구 ${valueLabel}`}
                aria-pressed={selected}
                aria-describedby={preview?.point.hour === point.hour ? tooltipId : undefined}
                onClick={() => onSelectHour(point.hour)}
                onMouseEnter={() => { setHoveredHour(point.hour); setDismissed(false); }}
                onFocus={(event) => {
                  if (event.currentTarget.matches(":focus-visible")) {
                    setHoveredHour(null);
                    setFocusedHour(point.hour);
                    setDismissed(false);
                  }
                }}
                onBlur={() => setFocusedHour(null)}
                className="relative flex h-full min-w-0 cursor-pointer items-end border-0 bg-transparent p-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-foundy-primary"
              >
                <span aria-hidden="true"
                  className={`block w-full rounded-t-sm ${point.value === null ? "border border-dashed border-neutral-500" : ""} ${selected ? "outline-1 -outline-offset-1 outline-foundy-primary-ink" : ""}`}
                  style={{ height, backgroundColor: point.value === null ? undefined : color }}
                />
              </button>
            );
          })}
        </div>
        {preview && (
          <PopulationChartTooltip
            id={tooltipId}
            point={{ ...preview.point, partial: preview.point.partial ?? false }}
            leftPercent={(previewIndex + 0.5) / bars.length * 100}
            barHeight={preview.height}
          />
        )}
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-between text-xs tabular-nums text-neutral-600">
        <span>00시</span><span>06시</span><span>12시</span><span>18시</span><span>23시</span>
      </div>
      <figcaption className="mt-3 text-sm leading-relaxed text-neutral-600">
        막대를 선택하면 지도와 구성 그래프의 시간이 바뀌어요.{points.some((point) => point.value === null) && " 점선은 공개 수치가 없는 시간이에요."}
      </figcaption>
    </figure>
  );
}
