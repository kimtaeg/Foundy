import { VerdictBadge } from "@/components/report/VerdictBadge";
import type { ReportCardData, ReportState, Verdict } from "@/types/report";

export type ReportCardSummaryProps = {
  card: ReportCardData;
  state: ReportState;
  verdict: Verdict;
  followUpPending: boolean;
};

export function ReportCardSummary({ card, state, verdict, followUpPending }: ReportCardSummaryProps) {
  const selected = card.options.find((option) => option.id === state.chosen);
  const title = !followUpPending && selected?.fx.resolved && verdict !== card.base
    ? selected.fx.resolved
    : card.title;

  return (
    <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_2rem] items-center gap-x-3 gap-y-1.5 rounded-sm py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary sm:py-5 [&::-webkit-details-marker]:hidden">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        {followUpPending
          ? <VerdictBadge verdict="low" label="결정함" />
          : <VerdictBadge verdict={verdict} />}
      </span>
      <h3 className="col-start-1 row-start-2 m-0 min-w-0 break-keep text-lg leading-snug font-semibold tracking-tight text-neutral-900 [overflow-wrap:anywhere] sm:text-xl">
        {title}
      </h3>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
        className="col-start-2 row-span-2 row-start-1 place-self-center text-neutral-600 transition-transform duration-200 ease-out group-open/report:rotate-180 motion-reduce:transition-none">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </summary>
  );
}
