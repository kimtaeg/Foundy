import type { EvidenceItemData } from "@/types/report";

export type EvidenceItemProps = {
  item: EvidenceItemData;
  date?: string;
};

export function EvidenceItem({ item, date }: EvidenceItemProps) {
  return (
    <article className="border-0 border-b border-solid border-neutral-200 pb-4 first:pt-0 last:border-0 last:pb-0">
      <span className="inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-sm font-medium text-neutral-700">
        {item.kind === "law" ? "법령" : "참고 자료"}
      </span>
      <h4 className="mb-0 mt-2 text-base font-semibold leading-snug tracking-tight text-neutral-900 [overflow-wrap:anywhere]">{item.source}</h4>
      {item.value && <p className="mb-0 mt-1.5 text-sm leading-relaxed text-neutral-600 [overflow-wrap:anywhere]">{item.value}</p>}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {date && <span className="text-sm text-neutral-600">자료 기준일 <time dateTime={date}>{date}</time></span>}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded text-sm font-semibold text-foundy-primary-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary">
            공식 사이트 확인 <span className="sr-only">(새 탭)</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 4h6v6m0-6L10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
            </svg>
          </a>
        )}
      </div>
    </article>
  );
}
