import { ReportCardActions } from "@/components/report/ReportCardActions";
import { ReportCardSummary } from "@/components/report/ReportCardSummary";
import { ReportOptions } from "@/components/report/ReportOptions";
import { ReportRationale } from "@/components/report/ReportRationale";
import type { ReportCardModel } from "@/types/report";

export type ReportCardProps = {
  model: ReportCardModel;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

export function ReportCard({ model, expanded = model.open, onExpandedChange }: ReportCardProps) {
  const { card, state, verdict } = model;
  return (
    <details id={`result-${card.id}`} open={expanded}
      onToggle={(event) => {
        if (event.currentTarget.open !== expanded) onExpandedChange?.(event.currentTarget.open);
      }}
      className="group/report min-w-0 scroll-mt-36 border-0 border-t border-solid border-neutral-200 xl:scroll-mt-24">
      <ReportCardSummary
        card={card}
        state={state}
        verdict={verdict}
        followUpPending={model.followUpPending}
      />
      <div className="grid min-w-0 items-start gap-y-4 pb-4 sm:gap-y-5 sm:pb-5">
        <ReportRationale reason={card.reason} />
        <ReportOptions
          card={card}
          state={state}
          actionTitle={model.action?.text}
          nextStep={model.nextSteps[0]}
        />
        <ReportCardActions cardId={card.id} />
      </div>
    </details>
  );
}
