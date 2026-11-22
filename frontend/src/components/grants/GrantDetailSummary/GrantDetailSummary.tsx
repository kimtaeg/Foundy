import { GrantDeadline } from "@/components/grants/GrantDeadline";
import { GrantEligibility } from "@/components/grants/GrantEligibility";
import { grantDisplay } from "@/lib/grants/format-grant";
import type { Grant } from "@/types/grants";

export interface GrantDetailSummaryProps {
  grant: Grant;
  deadline?: string;
  result: { label: string; tone: string };
}

export function GrantDetailSummary({ grant, deadline, result }: GrantDetailSummaryProps) {
  const { org } = grantDisplay(grant);
  const fields = [
    ["지원 대상", grant.who],
    ["지원 내용", grant.how],
    ["신청 마감", <GrantDeadline key="deadline" date={grant.deadline} label={deadline} applicationPeriod={grant.applicationPeriod} />],
    ["제출 서류", grant.submit.join(", ")],
  ] as const;

  return (
    <section aria-label="신청 안내">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-0 border-b border-solid border-neutral-200 pb-2">
        <h3 className="m-0 text-base font-semibold text-neutral-900">신청 안내</h3>
        <GrantEligibility {...result} organization={org} />
      </div>
      <dl className="mb-0 mt-4 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm leading-relaxed">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-600">{label}</dt>
            <dd className="m-0 text-neutral-800 [overflow-wrap:anywhere]">{value || "미정"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
