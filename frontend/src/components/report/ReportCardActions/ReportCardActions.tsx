export type ReportCardActionsProps = { cardId: string };

const actionStyle = "inline-flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-sm border-0 bg-transparent p-0 text-sm font-semibold text-foundy-primary-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary";

export function ReportCardActions({ cardId }: ReportCardActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6">
      <button type="button" className={actionStyle} data-nx="evid" data-id={cardId}>
        판정 근거 자세히
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </button>
      <button type="button" className={actionStyle} data-nx="focuschat" data-id={cardId}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 16.5 3.5 21l5-2A9 9 0 1 0 5 16.5Z" />
        </svg>
        이 항목 질문하기
      </button>
    </div>
  );
}
