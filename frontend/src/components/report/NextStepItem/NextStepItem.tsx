import { useId } from "react";
import { nextStepTrigger } from "@/lib/report/next-step-trigger";
import { destinations } from "@/data/navigation";
import type { NextStep } from "@/types/report";

export type NextStepItemProps = { step: NextStep };

export function NextStepItem({ step }: NextStepItemProps) {
  const descriptionId = useId();
  const destination = destinations.find(({ id }) => id === step.go[0])?.label ?? step.cta;

  return (
    <li className="border-0 border-b border-solid border-neutral-200 last:border-b-0">
      <button type="button" {...nextStepTrigger(step)}
        aria-label={step.t} aria-describedby={descriptionId}
        className="group/step flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-3 rounded-sm border-0 bg-white py-3 pr-1 pl-0 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foundy-primary">
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="min-w-0 break-keep text-[15px] leading-6 font-semibold text-neutral-900 [overflow-wrap:anywhere]">
            {step.t}{" "}
            <span className="ml-1 inline-block whitespace-nowrap rounded-md bg-neutral-100 px-2 py-0.5 align-middle text-[13px] leading-5 text-neutral-700">{destination}</span>
            {step.k === "new" && <span className="ml-1.5 inline-block whitespace-nowrap rounded-md bg-foundy-primary/10 px-2 py-0.5 align-middle text-[13px] leading-5 font-medium text-foundy-primary-ink">새로 생김</span>}
          </span>
          <span id={descriptionId} className="break-keep text-sm leading-5 text-neutral-600 [overflow-wrap:anywhere]">
            <span className="sr-only">{destination !== step.cta && `${destination}. `}{step.cta}. {step.k === "new" && "새로 생김. "}</span>{step.s}
          </span>
        </span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-500 group-hover/step:text-foundy-primary-ink">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </li>
  );
}
