export interface WizardStepProps {
  number: number;
  label: string;
  current: boolean;
  complete: boolean;
}

export function WizardStep({ number, label, current, complete }: WizardStepProps) {
  const marker = current ? "bg-foundy-primary text-white"
    : complete ? "bg-foundy-primary/10 text-foundy-primary-ink" : "bg-neutral-100 text-neutral-600";
  return (
    <li aria-current={current ? "step" : undefined} className="group flex min-w-0 flex-1 items-center gap-2 last:flex-none sm:gap-4 lg:flex-none">
      <span className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm leading-5 sm:gap-2 lg:w-full lg:rounded-lg lg:px-2.5 lg:py-2 ${current ? "font-semibold text-foundy-primary-ink lg:bg-foundy-primary/5" : "font-medium text-neutral-600"}`}>
        <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums ${marker}`}>
          {complete ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3.2 3.2L13 4.5" /></svg> : number}
        </span>
        {label}
        {complete && <span className="sr-only"> 완료</span>}
      </span>
      <span aria-hidden="true" className="h-px min-w-1 flex-1 bg-neutral-200 group-last:hidden lg:hidden" />
    </li>
  );
}
