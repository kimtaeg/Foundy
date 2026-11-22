import { nextStepTrigger } from "@/lib/report/next-step-trigger";
import type { NextStep } from "@/types/report";

export interface ReportStepButtonProps {
  cardId: string;
  task: string | NextStep;
  kind: "choice" | "next";
}

export function ReportStepButton({ cardId, task, kind }: ReportStepButtonProps) {
  const isChoice = kind === "choice";
  const recommendation = typeof task === "object";
  const title = recommendation ? task.t : task;
  const trigger = recommendation
    ? nextStepTrigger(task)
    : { "data-nx": isChoice ? "options" : "optionresult", "data-id": cardId, "aria-haspopup": "dialog" as const };
  const id = `${recommendation ? "report-next" : isChoice ? "option-picker" : "option-result"}-${cardId}`;
  const label = isChoice ? "선택하기" : "다음";

  return (
    <button type="button" id={id} {...trigger}
      aria-label={label} aria-describedby={`${id}-task`}
      className="flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border-0 bg-neutral-50 px-3 py-2 text-left hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary sm:px-4">
      <span aria-hidden="true" className="mx-1 size-2 shrink-0 rounded-full border border-solid border-neutral-400" />
      <span id={`${id}-task`} title={title} className="min-w-0 flex-1 truncate text-[15px] leading-6 text-neutral-800">{title}</span>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-foundy-primary-ink">
        {label}
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}
