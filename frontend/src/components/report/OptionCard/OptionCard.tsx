import { optionMeta } from "@/lib/report/option-meta";
import type { ReportOption } from "@/types/report";

export type OptionCardProps = {
  cardId: string;
  option: ReportOption;
  recommended: boolean;
};

export function OptionCard({ cardId, option, recommended }: OptionCardProps) {
  const meta = optionMeta(option);

  return (
    <button
      type="button"
      data-nx="opt"
      data-id={cardId}
      data-o={option.id}
      aria-haspopup="dialog"
      className="group/option flex min-h-11 w-full items-center gap-4 rounded-none border-0 bg-white py-4 pl-0 pr-1 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary motion-reduce:transition-none"
    >
      <span className="grid min-w-0 flex-1 gap-1.5">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 break-keep text-base font-semibold leading-6 text-neutral-900 [overflow-wrap:anywhere]">{option.label}</span>
          {recommended && (
            <span className="shrink-0 rounded-full bg-foundy-primary/10 px-2 py-0.5 text-[13px] font-semibold leading-5 text-foundy-primary-ink">추천</span>
          )}
        </span>
        {option.summary && <span className="max-w-prose break-keep text-sm leading-relaxed text-neutral-700 [overflow-wrap:anywhere]">{option.summary}</span>}
        {meta && <span className="break-keep text-[13px] leading-5 text-neutral-600 [overflow-wrap:anywhere]">{meta}</span>}
      </span>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-500 group-hover/option:text-foundy-primary-ink">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}
