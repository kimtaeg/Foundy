export interface HorizontalBarChartProps {
  title: string;
  rows: readonly { label: string; value: number | null; detail?: string; unavailableLabel?: string }[];
  unit?: string;
  formatValue?: (value: number) => string;
  maxValue?: number;
}

const formatNumber = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

export function HorizontalBarChart({ title, rows, unit = "", formatValue = formatNumber, maxValue }: HorizontalBarChartProps) {
  const values = rows.map((row) => row.value !== null && Number.isFinite(row.value) && row.value >= 0 ? row.value : null);
  const largest = Math.max(0, ...values.filter((value): value is number => value !== null));
  const scale = maxValue !== undefined && Number.isFinite(maxValue) && maxValue > 0 ? Math.max(maxValue, largest) : largest;
  return (
    <figure className="m-0" aria-label={title}>
      <figcaption className="mb-3 text-sm font-semibold text-neutral-800">{title}</figcaption>
      <ul className="m-0 list-none space-y-3 p-0">
        {rows.map((row, index) => (
          <li key={row.label}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm leading-relaxed">
              <span className="min-w-0 text-neutral-700">{row.label}</span>
              <span className="ml-auto max-w-full break-words text-right font-semibold tabular-nums text-neutral-800">
                {values[index] === null ? row.unavailableLabel ?? "미제공" : `${formatValue(values[index])}${unit}`}
                {row.detail && <span className="block text-xs font-normal text-neutral-600">{row.detail}</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden="true">
              {values[index] !== null && <div className="h-full rounded-full bg-foundy-primary" style={{ width: `${scale ? values[index] / scale * 100 : 0}%`, opacity: 1 - Math.min(index, 5) * 0.08 }} />}
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}
