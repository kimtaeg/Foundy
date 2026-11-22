import { VL } from "@/data/report";
import type { Verdict } from "@/types/report";

const segments: { key: Verdict; color: string }[] = [
  { key: "high", color: "bg-orange-600" },
  { key: "low", color: "bg-amber-400" },
  { key: "unknown", color: "bg-neutral-400" },
  { key: "ok", color: "bg-foundy-primary" },
];

export type ReportSummaryProps = {
  counts: Record<Verdict, number>;
  firstByVerdict: Partial<Record<Verdict, string>>;
};

export function ReportSummary({ counts, firstByVerdict }: ReportSummaryProps) {
  const visible = segments.filter(({ key }) => counts[key] > 0);
  const total = visible.reduce((sum, { key }) => sum + counts[key], 0);

  return (
    <section aria-labelledby="report-overview-title"
      className="grid min-w-0 gap-5 border-0 border-b border-solid border-neutral-200 pb-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] sm:items-end sm:gap-12 sm:pb-8">
      <div>
        <h2 id="report-overview-title" className="m-0 text-base font-semibold text-neutral-700">전체 점검 항목</h2>
        <p className="mb-0 mt-2 text-[42px] leading-none font-semibold tracking-tight text-neutral-900 tabular-nums sm:text-5xl">
          {total}<span className="ml-1 text-xl font-medium text-neutral-600">건</span>
        </p>
      </div>
      {total > 0 && (
        <div className="min-w-0">
          <h3 className="m-0 mb-2.5 text-sm font-semibold text-neutral-700">판정별 분포</h3>
          <div aria-hidden="true" className="flex h-2 gap-1 overflow-hidden rounded-full">
            {visible.map(({ key, color }) => (
              <span key={key} className={`h-full rounded-full ${color}`} style={{ flex: counts[key] }} />
            ))}
          </div>
          <ul className="m-0 mt-1.5 grid list-none grid-cols-2 items-center gap-x-3 p-0 text-sm text-neutral-700 sm:flex sm:flex-wrap sm:gap-x-4">
            {visible.map(({ key, color }) => {
              const target = firstByVerdict[key];
              const label = (
                <>
                  <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${color}`} />
                  {VL[key]} <strong className="font-semibold text-neutral-900 tabular-nums">{counts[key]}건</strong>
                </>
              );
              return (
                <li key={key}>
                  {target ? (
                    <button type="button" data-nx="go" data-p="report" data-focus={target}
                      aria-label={`${VL[key]} ${counts[key]}건, 첫 항목으로 이동`}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent p-0 text-sm text-inherit hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary">
                      {label}
                    </button>
                  ) : <span className="inline-flex min-h-8 items-center gap-1.5">{label}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
