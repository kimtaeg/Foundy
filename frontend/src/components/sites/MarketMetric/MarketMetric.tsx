import type { ReactNode } from "react";

export interface MarketMetricProps {
  label: string;
  children: ReactNode;
  unavailable?: boolean;
}
export function MarketMetric({ label, children, unavailable = false }: MarketMetricProps) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="text-neutral-600">{label}</span>
      <strong
        className={`text-right font-semibold tabular-nums ${unavailable ? "text-neutral-600" : "text-neutral-800"}`}
      >
        {children}
      </strong>
    </div>
  );
}
