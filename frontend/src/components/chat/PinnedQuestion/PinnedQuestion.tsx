export interface PinnedQuestionProps {
  title: string;
  verdict: string;
  verdictLabel: string;
}

export function PinnedQuestion({
  title,
  verdict,
  verdictLabel,
}: PinnedQuestionProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <span className={`text-xs font-medium ${verdict === "ok" ? "text-foundy-primary-ink" : "text-neutral-600"}`}>
          {verdictLabel} · 현재 상담 주제
        </span>
        <p className="mb-0 mt-0.5 text-sm font-medium leading-5 text-neutral-900 [overflow-wrap:anywhere]">{title}</p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
        data-nx="cfocus"
        data-id=""
        aria-label="상담 주제 고정 해제"
      >
        해제
      </button>
    </div>
  );
}
