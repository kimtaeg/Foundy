import { GrantConditionQuote } from "@/components/grants/GrantConditionQuote";
import type { Grant } from "@/types/grants";

export interface GrantConditionsProps {
  checks: Grant["checks"];
}

export function GrantConditions({ checks }: GrantConditionsProps) {
  return (
    <ul className="m-0 list-none p-0">
      {checks.map((condition) => <GrantConditionQuote key={condition[0]} condition={condition} />)}
    </ul>
  );
}
