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
      <figcaption className="mb-3 text-[15px] font-semibold text-neutral-900">{title}</figcaption>
      <ul className="m-0 list-none space-y-3 p-0">
        {rows.map((row, index) => {
          const value = values[index];
          const fraction = value !== null && scale > 0 ? value / scale : 0;
          return (
            <li key={row.label}>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm leading-relaxed">
                <span className="min-w-0 text-neutral-700">{row.label}</span>
                <span className="ml-auto text-right font-semibold text-neutral-900 tabular-nums">
                  {value === null ? row.unavailableLabel ?? "미제공" : `${formatValue(value)}${unit}`}
                  {row.detail && <span className="ml-2 inline-block text-xs font-normal text-neutral-600">{row.detail}</span>}
                </span>
              </div>
              {value === null ? (
                <div aria-hidden="true" className="h-1.5 border-0 border-b border-dashed border-neutral-300" />
              ) : (
                <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-foundy-primary" style={{ width: `${fraction * 100}%`, opacity: 0.15 + 0.85 * fraction }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
