import type { HourSel } from "@/types/foot-traffic";

interface Point {
  hour: number;
  value: number | null;
  detail: string;
}
export interface HourlyPopulationChartProps {
  points: readonly Point[];
  selectedHour: HourSel;
  onSelectHour: (hour: number) => void;
}

export function HourlyPopulationChart({ points, selectedHour, onSelectHour }: HourlyPopulationChartProps) {
  const publicValues = points.flatMap((point) => point.value === null ? [] : [point.value]);
  const maximum = Math.max(1, ...publicValues);
  const format = (value: number) => Math.round(value).toLocaleString("ko-KR");
  return (
    <figure className="m-0" aria-label="24시간 공개 생활인구 막대그래프">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs tabular-nums text-neutral-600">
        <span>공개값 · 명</span>
        <span>{publicValues.length ? `최대 ${format(Math.max(...publicValues))}` : "공개 수치 없음"}</span>
      </div>
      <div className="relative border-0 border-b border-solid border-neutral-200">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          <span className="border-0 border-t border-dashed border-neutral-100" />
          <span className="border-0 border-t border-dashed border-neutral-100" />
          <span />
        </div>
        <div className="relative grid h-36 grid-cols-24 items-end gap-0.5">
          {points.map((point) => {
            const label = `${String(point.hour).padStart(2, "0")}시`;
            const valueLabel = point.value === null ? point.detail : `${format(point.value)}명 · ${point.detail}`;
            const selected = selectedHour === point.hour;
            return (
              <button
                key={point.hour}
                type="button"
                aria-label={`${label} 생활인구 ${valueLabel}`}
                aria-pressed={selected}
                title={`${label} · ${valueLabel}`}
                onClick={() => onSelectHour(point.hour)}
                className="group relative flex h-full min-w-0 items-end justify-center border-0 bg-transparent p-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary"
              >
                <span
                  aria-hidden="true"
                  className={`block w-full rounded-t-sm transition-colors ${point.value === null ? "border border-dashed border-neutral-300 bg-transparent" : selected ? "bg-foundy-primary" : "bg-foundy-primary/35 group-hover:bg-foundy-primary/70"}`}
                  style={{ height: point.value === null ? 4 : Math.max(2, point.value / maximum * 136) }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-between gap-1 text-xs tabular-nums text-neutral-600">
        <span>00시</span><span>06시</span><span>12시</span><span>18시</span><span>23시</span>
      </div>
      <figcaption className="mt-3 text-sm leading-relaxed text-neutral-600">
        막대를 선택하면 지도와 구성 그래프의 시간도 바뀝니다. 점선은 숫자가 공개되지 않은 시간입니다.
      </figcaption>
    </figure>
  );
}
