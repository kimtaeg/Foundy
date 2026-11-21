import { Element } from "@/components/view/Element";
import { VL } from "@/data/report";
import { type Verdict } from "@/types/report";

export type VerdictBadgeProps = { verdict: Verdict };

export function VerdictBadge({ verdict }: VerdictBadgeProps) {
  return (
    <Element as="span" className={`nx-badge ${verdict}`}>
      {VL[verdict]}
    </Element>
  );
}
