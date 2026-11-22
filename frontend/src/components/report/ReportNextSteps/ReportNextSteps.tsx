import { NextStepItem } from "@/components/report/NextStepItem";
import type { ReportCardModel } from "@/types/report";

export type ReportNextStepsProps = { model: ReportCardModel };

export function ReportNextSteps({ model }: ReportNextStepsProps) {
  const { state, card, nextSteps } = model;
  if (
    (state.action !== "sent" && state.action !== "done") ||
    (card.options.length > 0 && !state.chosen)
  ) return null;

  return (
    <section className="nx-next grid min-w-0 gap-4">
      <h4 className="m-0 text-lg font-semibold leading-6 tracking-tight text-neutral-900">
        {state.action === "sent" ? "답변을 기다리는 동안 할 일" : "이어서 할 일"}
      </h4>
      {nextSteps.length ? (
        <ol role="list" className="m-0 min-w-0 list-none p-0">
          {nextSteps.map((step, index) => <NextStepItem key={`${step.t}-${index}`} step={step} />)}
        </ol>
      ) : (
        <div>
          <p className="m-0 text-[15px] leading-6 text-neutral-700">예정된 후속 작업이 없어요.</p>
          <button type="button" data-nx="cnav" data-p="checklist" data-focus="" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-0 text-sm font-semibold text-foundy-primary-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary">
            체크리스트 열기 <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </section>
  );
}
