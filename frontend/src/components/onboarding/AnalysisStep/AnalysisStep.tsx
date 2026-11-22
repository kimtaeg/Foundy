import { AnalysisStatusItem } from "@/components/common/AnalysisStatusItem";
import { primaryAction, stepFooter, stepTitle } from "../onboarding-styles";

export interface AnalysisStepProps {
  storeName: string;
  steps: string[];
  completed: number[];
  finished?: boolean;
  notes?: Record<number, string>;
}

export function AnalysisStep({ storeName, steps, completed, notes, finished = completed.length >= steps.length }: AnalysisStepProps) {
  const current = finished ? -1 : steps.findIndex((_, index) => !completed.includes(index));
  const title = storeName ? `${storeName}의 ` : "";
  return (
    <section aria-labelledby="store-analysis-title" className="min-w-0">
      <h2 id="store-analysis-title" tabIndex={-1} className={stepTitle}>
        {title}첫 점검이 {finished ? "완료됐어요" : "진행 중이에요"}
      </h2>
      <p role="status" className="mb-0 mt-2 flex items-center gap-2 text-sm font-medium leading-5 text-neutral-600">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full bg-foundy-primary ${finished ? "" : "motion-safe:animate-pulse"}`} />
        <span className="tabular-nums">{completed.length}/{steps.length}단계 처리</span>
      </p>
      <ol className="m-0 mt-5 list-none border-0 border-t border-solid border-neutral-200 p-0">
        {steps.map((label, index) => (
          <AnalysisStatusItem key={label} label={label} index={index} complete={completed.includes(index)} completeLabel={notes?.[index]} running={current === index} />
        ))}
      </ol>
      <div className={`${stepFooter} mt-5 justify-end`}>
        <button type="button" className={primaryAction} data-nx="finish" disabled={!finished}>
          내 가게 홈으로 <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
