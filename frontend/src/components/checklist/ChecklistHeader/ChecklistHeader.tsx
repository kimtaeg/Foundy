import { PageHeader } from "@/components/common/PageHeader";

export function ChecklistHeader() {
  return (
    <PageHeader
      eyebrow="OPENING ROADMAP"
      title="개업 체크리스트"
      description="시기별·카테고리별·달력으로 한 번에 확인하세요."
      actionsLayout="inline"
      actions={
        <button
          type="button"
          data-nx="ics"
          aria-label="캘린더로 내보내기 (.ics)"
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border border-solid border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition-colors hover:border-foundy-primary hover:text-foundy-primary-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary motion-reduce:transition-none sm:px-5 sm:text-[15px]"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
          </svg>
          <span>
            <span className="hidden sm:inline">캘린더로 </span>내보내기
          </span>
        </button>
      }
    />
  );
}
