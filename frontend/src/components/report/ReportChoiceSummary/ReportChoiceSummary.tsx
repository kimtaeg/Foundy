export interface ReportChoiceSummaryProps {
  cardId: string;
  completedTask: string;
}

export function ReportChoiceSummary({ cardId, completedTask }: ReportChoiceSummaryProps) {
  return (
    <button type="button" id={`option-history-${cardId}`} data-nx="optionresult" data-id={cardId} aria-haspopup="dialog"
      className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border-0 bg-foundy-primary/10 px-3 py-2 text-left text-[15px] leading-6 text-foundy-primary-ink hover:bg-foundy-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary sm:px-4">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="m5 12 4 4 10-10" />
      </svg>
      <span className="min-w-0 break-keep [overflow-wrap:anywhere]">
        <span className="sr-only">완료한 작업 </span><span className="font-semibold">{completedTask}</span>
      </span>
    </button>
  );
}
