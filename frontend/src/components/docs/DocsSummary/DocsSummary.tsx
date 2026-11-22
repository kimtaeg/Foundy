export interface DocsSummaryProps {
  summaryBasis?: "documents";
  total: number;
  finished: number;
  remaining: number;
}

export function DocsSummary({ total, finished, remaining, summaryBasis }: DocsSummaryProps) {
  const perDocument = summaryBasis === "documents";
  const percent = total > 0 ? Math.min(100, Math.max(0, (finished / total) * 100)) : 0;
  return (
    <section aria-label={perDocument ? "서류 준비 현황" : "체크리스트 기준 서류 현황"} className="grid min-w-0 items-end gap-5 border-0 border-b border-solid border-neutral-200 pb-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-12 sm:pb-8">
      <div>
        <h2 className="m-0 text-base font-semibold text-neutral-700">{perDocument ? "준비할 서류" : "남은 항목의 서류"}</h2>
        <p className="mb-0 mt-2 text-[42px] leading-none font-semibold tracking-tight text-neutral-900 tabular-nums sm:text-5xl">
          {remaining}<span className="ml-1 text-xl font-medium text-neutral-600">개</span>
        </p>
      </div>
      <div className="min-w-0 sm:pb-1">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-neutral-600 sm:text-[15px]">
          <span>{perDocument ? "준비한 서류" : "완료한 항목"} <strong className="font-semibold text-foundy-primary-ink tabular-nums">{finished}개</strong></span>
          <span>전체 <strong className="font-semibold text-neutral-900 tabular-nums">{total}개</strong></span>
        </div>
        <div role="meter" aria-label={perDocument ? "전체 서류 중 준비한 비율" : "전체 서류 중 완료한 체크리스트 항목에 속한 비율"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={`전체 ${total}개 중 ${finished}개`}
          className="h-2 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-foundy-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </section>
  );
}
