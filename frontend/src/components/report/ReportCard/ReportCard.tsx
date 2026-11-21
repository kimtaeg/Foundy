import { ReportCardActions } from "@/components/report/ReportCardActions";
import { ReportCardSummary } from "@/components/report/ReportCardSummary";
import { ReportFollowUp } from "@/components/report/ReportFollowUp";
import { ReportNextSteps } from "@/components/report/ReportNextSteps";
import { ReportOptions } from "@/components/report/ReportOptions";
import { Element } from "@/components/view/Element";
import { type ReportCardModel } from "@/types/report";

/** 접고 펼 수 있는 점검 카드. 지금 결정이 필요한 가장 급한 카드만 펼쳐 둔다. */
export type ReportCardProps = { model: ReportCardModel };

export function ReportCard({ model }: ReportCardProps) {
  const { card, state, verdict, open } = model;
  const simple = card.base === "ok" && !card.options.length;
  return (
    <Element
      as="details"
      className="nx-card group"
      id={`result-${card.id}`}
      open={open}
    >
      <ReportCardSummary
        card={card}
        state={simple ? {} : state}
        verdict={simple ? "ok" : verdict}
        followUpPending={model.followUpPending}
        status={model.statusLabel}
      />
      <Element as="p" className="nx-muted mt-3">
        {card.reason}
      </Element>
      {!simple && (
        <>
          <ReportOptions card={card} state={state} verdict={verdict} />
          <ReportFollowUp model={model} />
          <ReportNextSteps model={model} />
        </>
      )}
      <ReportCardActions cardId={card.id} />
    </Element>
  );
}
