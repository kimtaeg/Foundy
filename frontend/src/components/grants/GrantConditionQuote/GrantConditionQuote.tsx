import { GrantBadge } from "@/components/grants/GrantBadge";
import type { Grant } from "@/types/grants";

export interface GrantConditionQuoteProps {
  condition: Grant["checks"][number];
}

export function GrantConditionQuote({ condition }: GrantConditionQuoteProps) {
  const [label, status, quote] = condition;
  return (
    <li className="border-0 border-b border-solid border-neutral-200 py-3 last:border-0 last:pb-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="min-w-0 text-sm font-semibold text-neutral-800 [overflow-wrap:anywhere]">{label}</span>
        <GrantBadge label={status === "pass" ? "충족" : "확인 필요"} tone={status === "pass" ? "ok" : "low"} />
      </div>
      <p className="mb-0 mt-1 text-sm leading-relaxed text-neutral-600 [overflow-wrap:anywhere]">{quote}</p>
    </li>
  );
}
