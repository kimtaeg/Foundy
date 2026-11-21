import { Element } from "@/components/view/Element";
import { type Grant } from "@/types/grants";

export interface GrantConditionsProps { checks: Grant["checks"] }

export function GrantConditions({ checks }: GrantConditionsProps) {
  return (
    <Element className="nx-chips">
      {checks.map(([label, state]) => (
        <span key={label} className={state}>
          {state === "pass" ? "✓" : "?"} {label.split(" (")[0]}
        </span>
      ))}
    </Element>
  );
}
