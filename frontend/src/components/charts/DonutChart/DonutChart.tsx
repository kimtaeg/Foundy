export interface DonutChartProps {
  title: string;
  rows: readonly { label: string; value: number | null; unavailableLabel?: string; color?: string }[];
  unit?: string;
  centerLabel?: string;
  formatValue?: (value: number) => string;
  showPercent?: boolean;
}

const COLORS = ["#107e7d", "#a1cfca", "#0b5554", "#52a9a6", "#737373", "#d4d4d4"];
const formatNumber = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

export function DonutChart({ title, rows, unit = "", centerLabel = "합계", formatValue = formatNumber, showPercent = true }: DonutChartProps) {
  const values = rows.map((row) => row.value !== null && Number.isFinite(row.value) && row.value >= 0 ? row.value : null);
  const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const segments = values.map((value, index) => {
    const percent = total > 0 && value !== null ? value / total * 100 : 0;
    const preceding = values.slice(0, index).reduce<number>((sum, item) => sum + (item ?? 0), 0);
    return { color: rows[index].color ?? COLORS[index % COLORS.length], percent, offset: total ? preceding / total * 100 : 0 };
  });
  return (
    <figure className="m-0" aria-label={title}>
      <figcaption className="mb-3 text-[15px] font-semibold text-neutral-900">{title}</figcaption>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-3">
        <div className="relative mx-auto size-28 shrink-0" aria-hidden="true">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#f5f5f5" strokeWidth="12" />
            {segments.map((segment, index) => segment.percent > 0 && (
              <circle key={rows[index].label} cx="60" cy="60" r="50" fill="none" stroke={segment.color} strokeWidth="12" pathLength="100"
                strokeDasharray={`${segment.percent} ${100 - segment.percent}`} strokeDashoffset={-segment.offset} />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-xs text-neutral-600">{centerLabel}</span>
            <strong className="text-xl font-semibold tracking-tight tabular-nums text-neutral-900">{values.some((value) => value !== null) ? formatValue(total) : "—"}</strong>
            {unit && <span className="text-xs font-medium text-neutral-600">{unit}</span>}
          </div>
        </div>
        <ul className="m-0 min-w-0 flex-1 basis-40 list-none space-y-2.5 p-0">
          {rows.map((row, index) => (
            <li key={row.label} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm leading-relaxed">
              <span className="flex min-w-0 items-center gap-1.5 text-neutral-700">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: segments[index].color }} aria-hidden="true" />
                <span>{row.label}</span>
              </span>
              <span className="ml-auto max-w-full break-words text-right font-semibold tabular-nums text-neutral-800">
                {values[index] === null ? row.unavailableLabel ?? "미제공" : `${formatValue(values[index])}${unit}`}
                {showPercent && total > 0 && values[index] !== null && <span className="ml-1.5 font-normal text-neutral-600">{segments[index].percent.toFixed(1)}%</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
