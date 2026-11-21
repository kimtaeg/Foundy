import { LEVEL_META, fmtInt, type CellStat, type CrowdLevel, type HourSel } from "@/lib/foot-traffic";

export interface PopulationTooltipProps { value: CellStat; level: CrowdLevel | null; label: string; hour: HourSel }

export function PopulationTooltip({ value, level, label, hour }: PopulationTooltipProps) {
  return (
    <div role="tooltip" className="pointer-events-none min-w-44 rounded-xl border border-solid border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded px-1.5 py-0.5 text-xs font-bold text-neutral-700" style={{ backgroundColor: level ? `${LEVEL_META[level].color}22` : "#f5f5f5" }}>
          {level ? LEVEL_META[level].label : "비식별"}
        </span>
        <b>{value.observed ? `약 ${fmtInt(value.sum)}명` : "공개 숫자 없음"}</b>
      </div>
      <div className="text-xs text-neutral-600">{label} · {hour === "avg" ? "공개시간 평균" : `${hour}시`} · 250m 격자</div>
      {hour === "avg" && <div className="mt-1 text-xs text-neutral-600">공개값 있는 시간 {value.observedHours}/24 · 원본 행 {value.presentHours}/24</div>}
      {value.suppressed > 0 && <div className="mt-1 text-xs text-neutral-600">비식별 값 제외</div>}
    </div>
  );
}
