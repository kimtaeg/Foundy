import { Element } from "@/components/view/Element";
import { type Grant } from "@/types/grants";

export interface GrantConditionQuoteProps {
  condition: Grant["checks"][number];
}

export function GrantConditionQuote({
  condition,
}: GrantConditionQuoteProps) {
  const [label, status, quote] = condition;
  return (
    <Element className="nx-note">
      <b>
        {status === "pass" ? "✓ 충족" : "? 확인 필요"} · {label}
      </b>
      <p>{quote}</p>
    </Element>
  );
}
