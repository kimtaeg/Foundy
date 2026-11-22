import { VerdictBadge } from "@/components/report/VerdictBadge";
import { Element } from "@/components/view/Element";
import { type ReportCardData } from "@/types/report";

export type DecisionItemProps = { card: ReportCardData };

export function DecisionItem({ card }: DecisionItemProps) {
  const recommended = card.options.find((option) => card.rec?.id === option.id);
  return (
    <Element className="nx-seg">
      <Element className="nx-badges">
        <VerdictBadge verdict={card.base} />
        <Element as="span" className="nx-muted">
          {card.stage}
        </Element>
      </Element>
      <b>{card.title}</b>
      {recommended && (
        <Element className="nx-muted">추천: {recommended.label}</Element>
      )}
      <Element className="nx-row mt-[9px]">
        <Element
          as="button"
          className="nx-btn outline"
          data-nx="go"
          data-p="report"
          data-focus={card.id}
        >
          카드 열기
        </Element>
      </Element>
    </Element>
  );
}
