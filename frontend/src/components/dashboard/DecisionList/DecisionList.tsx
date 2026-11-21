import { DecisionItem } from "@/components/dashboard/DecisionItem";
import { Element } from "@/components/view/Element";
import { type ReportCardData } from "@/types/report";

export type DecisionListProps = {
  cards: ReportCardData[];
  undecided: boolean;
};

export function DecisionList({
  cards,
  undecided,
}: DecisionListProps) {
  return (
    <Element as="section" className="nx-card">
      <Element className="nx-heading">
        <h3>결정할 것</h3>
        <Element
          as="button"
          className="nx-btn ghost"
          data-nx="go"
          data-p="report"
        >
          전체 리포트 →
        </Element>
      </Element>
      {undecided ? (
        <Element className="nx-empty">
          자리를 정하면 결정할 항목이 여기에 나타나요.
        </Element>
      ) : cards.length ? (
        cards.map((card) => <DecisionItem key={card.id} card={card} />)
      ) : (
        <Element className="nx-empty">결정할 항목이 없어요.</Element>
      )}
    </Element>
  );
}
