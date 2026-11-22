import type { HourSel } from "@/types/foot-traffic";

export interface PopulationTimeProps {
  hour: HourSel;
  lastHour: number;
  onChange: (hour: HourSel) => void;
}

export function PopulationTime({ hour, lastHour, onChange }: PopulationTimeProps) {
  return (
    <section className="border-0 border-t border-solid border-neutral-200 py-4" aria-label="분석 시간 설정">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-base font-semibold tracking-tight text-neutral-900">분석 시간</h3>
        <div className="inline-flex gap-0.5 rounded-lg bg-neutral-100 p-1" role="group" aria-label="분석 시간 방식">
          {(["avg", lastHour] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={value === "avg" ? hour === "avg" : hour !== "avg"}
              onClick={() => onChange(value)}
              className="min-h-8 cursor-pointer rounded-md border-0 bg-transparent px-2.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 aria-pressed:bg-white aria-pressed:font-semibold aria-pressed:text-foundy-primary-ink focus-visible:outline-2 focus-visible:outline-foundy-primary"
            >
              {value === "avg" ? "일평균" : "시간대"}
            </button>
          ))}
        </div>
      </div>
      {hour === "avg" ? (
        <p className="mb-0 mt-2.5 text-sm leading-relaxed text-neutral-600">격자마다 공개된 시간의 평균을 보여줘요.</p>
      ) : (
        <div className="mt-2.5">
          <label htmlFor="traffic-hour" className="block text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
            {String(hour).padStart(2, "0")}:00
          </label>
          <input
            id="traffic-hour"
            aria-label="분석 시간"
            aria-valuetext={`${hour}시`}
            className="m-0 block h-8 w-full cursor-pointer accent-foundy-primary focus-visible:outline-foundy-primary"
            type="range" min={0} max={23} value={hour} onChange={(event) => onChange(Number(event.target.value))}
          />
          <div aria-hidden="true" className="flex justify-between text-xs text-neutral-600 tabular-nums"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>23시</span></div>
        </div>
      )}
    </section>
  );
}
