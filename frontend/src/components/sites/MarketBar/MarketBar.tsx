import type { ChartRow } from "@/types/market";

export type MarketBarProps = ChartRow;

export function MarketBar({ label, value, percent }: MarketBarProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(60px,1fr)_auto] items-center gap-3 text-sm">
      <span className="truncate text-neutral-600">{label}</span>
      <span
        className="h-1.5 overflow-hidden rounded-full bg-neutral-100"
        aria-hidden="true"
      >
        <span
          className="block h-full rounded-full bg-foundy-primary"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </span>
      <span className="min-w-7 text-right font-medium tabular-nums text-neutral-800">
        {value}곳
      </span>
    </div>
  );
}
