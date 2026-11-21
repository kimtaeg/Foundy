import { Element } from "@/components/view/Element";
import { type Grant } from "@/types/grants";

export interface GrantSummaryProps {
  grant: Grant;
  deadline: string;
}

export function GrantSummary({
  grant,
  deadline,
}: GrantSummaryProps) {
  return (
    <Element className="nx-muted">
      누가 · {grant.who}
      <br />
      얼마 · {grant.how}
      <br />
      언제까지 · {grant.deadline ? `${grant.deadline} (${deadline})` : "미정"}
    </Element>
  );
}
