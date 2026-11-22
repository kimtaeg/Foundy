export type AnalysisStatusItemProps = {
  label: string;
  index: number;
  complete: boolean;
  running: boolean;
  completeLabel?: string;
};

export function AnalysisStatusItem({ label, index, complete, running, completeLabel = "완료" }: AnalysisStatusItemProps) {
  const indicator = complete || running ? "bg-foundy-primary/10 text-foundy-primary-ink" : "bg-neutral-100 text-neutral-600";
  return (
    <li aria-current={running ? "step" : undefined} className="flex min-w-0 items-center gap-3 border-0 border-b border-solid border-neutral-100 py-3 last:border-b-0">
      <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums ${indicator}`}>
        {complete ? "✓" : index + 1}
      </span>
      <span className="min-w-0 flex-1 break-words text-sm font-medium leading-5 text-neutral-900 sm:text-base">{label}</span>
      <span className={`max-w-[45%] shrink-0 break-words rounded-md px-2 py-1 text-right text-xs font-medium leading-5 ${indicator}`}>
        {complete ? completeLabel : running ? "진행 중" : "대기"}
      </span>
    </li>
  );
}
