import { REPORT_STAGES } from "@/data/report";

export type ReportFiltersProps = { selected: string };

const stages = ["all", ...REPORT_STAGES];

export function ReportFilters({ selected }: ReportFiltersProps) {
  return (
    <div role="group" aria-label="점검 단계 필터" className="flex flex-wrap items-center gap-1.5">
      {stages.map((stage) => (
        <button key={stage} type="button" data-nx="rfilter" data-v={stage} aria-pressed={selected === stage}
          className="min-h-9 cursor-pointer whitespace-nowrap rounded-full border-0 bg-neutral-100 px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary aria-pressed:bg-foundy-primary aria-pressed:text-white motion-reduce:transition-none sm:px-3.5">
          {stage === "all" ? "전체" : stage}
        </button>
      ))}
    </div>
  );
}
