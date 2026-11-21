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
        {grant.example && (
          <Element as="span" className="nx-badge unknown">
            예시 공고
          </Element>
        )}
      </Element>
      <Element as="p" className="nx-muted">
        누가 · {grant.who}
        <br />
        얼마 · {grant.how}
        <br />
        언제까지 · {grant.deadline || "미정"}
        <br />
        내야 할 것 · {grant.submit.length ? grant.submit.join(", ") : "공고 원문 확인"}
      </Element>
      {grant.url && (
        <Element as="p">
          <a href={grant.url} target="_blank" rel="noreferrer">
            공고 원문 보기 ({grant.org})
          </a>
        </Element>
      )}
    </div>
  );
}
