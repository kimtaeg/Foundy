import { ReportFollowUp } from "@/components/report/ReportFollowUp";
import { ReportNextSteps } from "@/components/report/ReportNextSteps";
import { VerdictBadge } from "@/components/report/VerdictBadge";
import type { ReportCardModel } from "@/types/report";

export interface ReportResultDialogProps {
  model: ReportCardModel;
}

export function ReportResultDialog({ model }: ReportResultDialogProps) {
  const { card, state, verdict } = model;
  const selected = card.options.find((option) => option.id === state.chosen);
  if (!selected && (card.options.length > 0 || !model.action)) return null;
  const showNextSteps = state.action === "done" || state.action === "sent";

  return (
    <div className="grid min-w-0 gap-5 sm:gap-6">
      {selected && (
        <section className="grid min-w-0 gap-3">
          <h3 className="m-0 break-keep text-xl font-semibold leading-7 tracking-tight text-neutral-900 [overflow-wrap:anywhere]">{selected.label}</h3>
          {verdict !== card.base && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="sr-only">이전 판정</span><VerdictBadge verdict={card.base} />
              <span aria-hidden="true" className="text-sm text-neutral-500">→</span>
              <span className="sr-only">현재 판정</span><VerdictBadge verdict={verdict} />
            </div>
          )}
          {selected.fx.changes.length > 0 && (
            <ul aria-label="변경 내용" className="m-0 grid list-disc gap-1.5 pl-5 text-[15px] leading-6 text-neutral-700 marker:text-neutral-400">
              {selected.fx.changes.map((change) => <li key={change} className="break-keep [overflow-wrap:anywhere]">{change}</li>)}
            </ul>
          )}
        </section>
      )}
      {model.action && (
        <div className={selected ? "border-0 border-t border-solid border-neutral-200 pt-5 sm:pt-6" : undefined}>
          <ReportFollowUp model={model} />
        </div>
      )}
      {showNextSteps && (
        <div className="border-0 border-t border-solid border-neutral-200 pt-5 sm:pt-6">
          <ReportNextSteps model={model} />
        </div>
      )}
    </div>
  );
}
