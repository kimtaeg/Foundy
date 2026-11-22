import type { Verdict } from "@/types/report";

export interface ReportStatusStripProps {
  counts: Record<Verdict, number>;
  sourceLabel?: string;
}

const segments: { key: Verdict; label: string; color: string }[] = [
  { key: "high", label: "위반 소지 높음", color: "bg-orange-600" },
  { key: "unknown", label: "판단 불가", color: "bg-neutral-400" },
  { key: "low", label: "확인 권장", color: "bg-amber-400" },
  { key: "ok", label: "문제 없음", color: "bg-foundy-primary" },
];

export function ReportStatusStrip({ counts }: ReportStatusStripProps) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, counts[segment.key]), 0);
  return (
    <div className="mt-8 border-0 border-t border-solid border-neutral-200 pt-6 sm:mt-5 sm:pt-4">
      {total ? (
        <>
          <div aria-hidden="true" className="mb-3 flex h-1.5 gap-1 overflow-hidden rounded-full">
            {segments.filter((segment) => counts[segment.key] > 0).map((segment) => (
              <span key={segment.key} className={`h-full rounded-full ${segment.color}`} style={{ flex: counts[segment.key] }} />
            ))}
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1.5 p-0 text-xs text-neutral-600">
            {segments.filter((segment) => counts[segment.key] > 0).map((segment) => (
              <li key={segment.key} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={`size-1.5 rounded-full ${segment.color}`} />
                {segment.label} <span className="font-semibold tabular-nums text-neutral-900">{counts[segment.key]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="m-0 text-sm text-neutral-600">아직 점검 결과가 없어요.</p>}
    </div>
  );
}
