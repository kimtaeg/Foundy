import type { HourSel } from "@/types/foot-traffic";

export interface PopulationTimeProps { hour: HourSel; lastHour: number; onChange: (hour: HourSel) => void }

export function PopulationTime({ hour, lastHour, onChange }: PopulationTimeProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-neutral-600">분석 시간</span>
        <div className="flex rounded-lg bg-neutral-100 p-1" role="group" aria-label="분석 시간 방식">
          {(["avg", lastHour] as const).map((value) => {
            const active = value === "avg" ? hour === "avg" : hour !== "avg";
            return <button type="button" key={value} aria-pressed={active} onClick={() => onChange(value)}
              className={`rounded-md border-0 px-2.5 py-1.5 text-sm ${active ? "bg-white font-semibold text-neutral-900" : "bg-transparent text-neutral-600"}`}>
              {value === "avg" ? "일평균" : "시간대"}
            </button>;
          })}
        </div>
      </div>
      {hour === "avg" ? <p className="m-0 text-sm leading-relaxed text-neutral-600">공개값이 있는 시간의 평균이에요. 24시간 모두 공개되지 않은 격자가 있어요.</p> : (
        <div>
          <label htmlFor="traffic-hour" className="mb-2 block text-right text-sm font-semibold tabular-nums">{String(hour).padStart(2, "0")}:00</label>
          <input id="traffic-hour" aria-label="분석 시간" className="m-0 h-4 w-full accent-foundy-primary" type="range" min={0} max={23} value={hour} onChange={(event) => onChange(Number(event.target.value))} />
          <div className="mt-1 flex justify-between text-xs text-neutral-600"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>23시</span></div>
        </div>
      )}
    </div>
  );
}
