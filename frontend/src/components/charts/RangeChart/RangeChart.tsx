export interface RangeChartProps {
  title: string;
  min: number;
  median: number;
  max: number;
  value?: number | null;
  format?: (value: number) => string;
}

/** Displays known bounds and a median, without implying a frequency distribution. */
export function RangeChart({
  title,
  min,
  median,
  max,
  value = null,
  format = (amount) => amount.toLocaleString("ko-KR"),
}: RangeChartProps) {
  const valid = [min, median, max].every(Number.isFinite) && min <= median && median <= max;
  if (!valid) return <p className="text-sm leading-relaxed text-neutral-600">비교 범위를 확인할 수 없어요.</p>;
  const current = value !== null && Number.isFinite(value) ? value : null;
  const start = Math.min(min, current ?? min);
  const end = Math.max(max, current ?? max);
  const span = end - start;
  const position = (amount: number) => span === 0 ? 50 : ((amount - start) / span) * 100;
  const statistics = [
    { label: "최저", amount: min },
    { label: "중앙값", amount: median },
    { label: "최고", amount: max },
  ];

  return (
    <figure className="m-0" aria-label={title}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-neutral-800">
        <span>{title}</span>
        {current !== null && <span className="rounded-full bg-foundy-primary/10 px-2.5 py-1 tabular-nums text-foundy-primary-ink">내 가격 {format(current)}</span>}
      </figcaption>
      <div className="relative mx-2 my-5 h-7" aria-hidden="true">
        <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-neutral-100" />
        <div className="absolute top-2.5 h-2 rounded-full bg-foundy-primary/25" style={{ left: `${position(min)}%`, width: `${position(max) - position(min)}%` }} />
        {statistics.map(({ label, amount }) => (
          <span key={label} className="absolute top-1.5 h-4 w-0.5 -translate-x-1/2 rounded-full bg-neutral-400" style={{ left: `${position(amount)}%` }} />
        ))}
        {current !== null && <span className="absolute top-0.5 size-6 -translate-x-1/2 rounded-full border-[5px] border-solid border-white bg-foundy-primary ring-1 ring-foundy-primary/20" style={{ left: `${position(current)}%` }} />}
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2 rounded-xl bg-neutral-50 p-3 text-center">
        {statistics.map(({ label, amount }) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-neutral-600">{label}</dt>
            <dd className="m-0 mt-1 break-words text-sm font-semibold tabular-nums text-neutral-800">{format(amount)}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
