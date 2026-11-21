import { Element } from "@/components/view/Element";

export type ReportCardActionsProps = { cardId: string };

export function ReportCardActions({ cardId }: ReportCardActionsProps) {
  return (
    <Element className="nx-row mt-2">
      <Element
        as="button"
        className="nx-btn ghost slim"
        data-nx="evid"
        data-id={cardId}
      >
        판정 근거 자세히
      </Element>
      <Element
        as="button"
        className="nx-btn ghost slim"
        data-nx="focuschat"
        data-id={cardId}
      >
        이 항목 질문하기
      </Element>
    </Element>
  );
}
