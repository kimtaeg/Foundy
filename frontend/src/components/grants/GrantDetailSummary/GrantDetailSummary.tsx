import { Element } from "@/components/view/Element";
import { type Grant } from "@/types/grants";

export interface GrantDetailSummaryProps {
  grant: Grant;
  result: { label: string; tone: string };
}

export function GrantDetailSummary({
  grant,
  result,
}: GrantDetailSummaryProps) {
  return (
    <div>
      <Element className="nx-badges">
        <Element as="span" className={`nx-badge ${result.tone}`}>
          {result.label}
        </Element>
        <Element as="span" className="nx-badge unknown">
          예시 공고
        </Element>
      </Element>
      <Element as="p" className="nx-muted">
        누가 · {grant.who}
        <br />
        얼마 · {grant.how}
        <br />
        언제까지 · {grant.deadline || "미정"}
        <br />
        내야 할 것 · {grant.submit.join(", ")}
      </Element>
    </div>
  );
}
