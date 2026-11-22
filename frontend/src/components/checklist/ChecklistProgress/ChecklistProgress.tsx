export interface ChecklistProgressProps {
  opening: string;
  done: number;
  total: number;
}

export function ChecklistProgress({
  opening,
  done,
  total,
}: ChecklistProgressProps) {
  const percent =
    total > 0
      ? Math.min(100, Math.max(0, Math.round((done / total) * 100)))
      : 0;
  return (
    <section
      data-testid="checklist-progress"
      aria-label="전체 준비 현황"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-0 border-b border-solid border-neutral-200 pb-6 sm:gap-12 sm:pb-8"
    >
      <div className="min-w-0 sm:max-w-md">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 sm:mb-3">
          <div>
            <h2 className="mb-2 mt-0 text-sm font-medium text-neutral-600">
              체크리스트 완료율
            </h2>
            <p className="m-0 text-[40px] leading-none font-semibold tracking-tight text-neutral-900 tabular-nums sm:text-5xl">
              {percent}
              <span className="ml-1 text-xl">%</span>
            </p>
          </div>
          <p className="m-0 pb-1 text-sm text-neutral-600 tabular-nums">
            <span className="font-semibold text-neutral-900">{done}</span> /{" "}
            {total} 완료
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="전체 체크리스트 완료율"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${total}개 중 ${done}개 완료`}
          className="h-1.5 overflow-hidden rounded-full bg-neutral-100"
        >
          <div
            className="h-full rounded-full bg-foundy-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <div className="min-w-0 sm:pr-1">
        <p className="m-0 text-sm text-neutral-600">개업 예정일</p>
        <button
          type="button"
          data-nx="editDate"
          aria-label={`개업일 수정, ${opening || "날짜 미정"}`}
          className="group flex min-h-11 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-lg font-semibold tracking-tight text-neutral-900 tabular-nums transition-colors hover:text-foundy-primary-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary motion-reduce:transition-none sm:text-2xl"
        >
          {opening ? opening.replaceAll("-", ".") : "날짜 미정"}
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
            className="text-foundy-primary-ink"
          >
            <path d="m14 6 4 4M4 20l1.2-5.2L15.8 4.2a2.8 2.8 0 0 1 4 4L9.2 18.8 4 20Z" />
          </svg>
        </button>
      </div>
    </section>
  );
}
