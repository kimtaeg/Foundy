import type { GrantFilters, GrantResult } from "@/types/grants";

const outcomes = [
  { key: "eligible", label: "신청 가능성 높음", color: "bg-foundy-primary" },
  { key: "partial", label: "일부 확인 필요", color: "bg-amber-400" },
  { key: "unknown", label: "판단 불가", color: "bg-neutral-400" },
] as const;

export interface GrantStatusFilterProps {
  selected: GrantFilters["res"];
  counts?: Record<GrantResult, number>;
}

export function GrantStatusFilter({ selected, counts }: GrantStatusFilterProps) {
  const total = counts && outcomes.reduce((sum, outcome) => sum + counts[outcome.key], 0);
  return (
    <section aria-labelledby="grant-status-title" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="grant-status-title" className="m-0 text-lg font-semibold tracking-tight sm:text-xl">신청 자격별 공고</h2>
        <button type="button" data-nx="gf" data-k="res" data-v="all" aria-pressed={selected === "all"}
          className="min-h-9 rounded-full border-0 bg-transparent px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100 aria-pressed:bg-foundy-primary/10 aria-pressed:text-foundy-primary-ink">
          전체{total !== undefined && ` ${total}건`}
        </button>
      </div>
      <div role="group" aria-label="신청 자격 필터" className="grid grid-cols-3 gap-1 sm:gap-3">
        {outcomes.map(({key, label, color}) => (
          <button key={key} type="button" data-nx="gf" data-k="res" data-v={key} aria-pressed={selected === key}
            className="flex min-h-11 min-w-0 flex-col items-start justify-between rounded-lg border-0 bg-transparent px-1 py-2 text-left hover:bg-neutral-50 aria-pressed:bg-neutral-100 sm:px-2">
            <span className="flex items-start gap-1.5 text-sm font-medium leading-5 text-neutral-700">
              <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${color}`} /><span className="break-keep">{label}</span>
            </span>
            {counts && <span className="mt-1 block text-3xl font-semibold leading-tight tracking-tight text-neutral-900 tabular-nums sm:text-4xl">
              {counts[key]}<span className="ml-1 text-sm font-medium text-neutral-600">건</span>
            </span>}
          </button>
        ))}
      </div>
      {counts && (
        <div aria-hidden="true" className="mt-3 flex h-1.5 gap-1 overflow-hidden rounded-full bg-neutral-100">
          {outcomes.filter(({key}) => counts[key] > 0).map(({key, color}) => (
            <span key={key} className={`rounded-full ${color}`} style={{flex: counts[key]}} />
          ))}
        </div>
      )}
    </section>
  );
}
