import { Element } from "@/components/view/Element";

export interface GrantEligibilityProps {
  label: string;
  tone: string;
  example?: boolean;
}

export function GrantEligibility({
  label,
  tone,
  example = false,
}: GrantEligibilityProps) {
  return (
    <Element className="nx-badges">
      <Element as="span" className={`nx-badge ${tone}`}>
        {label}
      </Element>
      {example && (
        <Element as="span" className="nx-badge unknown">
          예시
        </Element>
      )}
    </Element>
  );
}
