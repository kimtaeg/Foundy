import { VL } from "@/data/report";
import type { Verdict } from "@/types/report";

const colors: Record<Verdict, string> = {
  high: "bg-orange-50 text-orange-800",
  low: "bg-[var(--amber-bg)] text-[var(--amber)]",
  unknown: "bg-neutral-100 text-neutral-700",
  ok: "bg-foundy-primary/10 text-foundy-primary-ink",
};

export type VerdictBadgeProps = { verdict: Verdict; label?: string };

export function VerdictBadge({ verdict, label }: VerdictBadgeProps) {
  return (
    <span className={`inline-block w-fit max-w-full rounded-md px-2 py-0.5 text-[13px] leading-5 font-semibold [overflow-wrap:anywhere] ${colors[verdict]}`}>
      {label ?? VL[verdict]}
    </span>
  );
}
