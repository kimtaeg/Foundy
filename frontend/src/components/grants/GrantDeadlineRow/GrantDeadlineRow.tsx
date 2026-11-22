import { GrantCardActions } from "@/components/grants/GrantCardActions";
import { GrantEligibility } from "@/components/grants/GrantEligibility";
import { grantDisplay } from "@/lib/grants/format-grant";
import type { Grant } from "@/types/grants";

export interface GrantDeadlineRowProps {
  grant: Grant;
  label: string;
  tone: string;
  deadline: string;
}

export function GrantDeadlineRow({ grant, label, tone, deadline }: GrantDeadlineRowProps) {
  const { title, org } = grantDisplay(grant);
  return (
    <article className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-x-3 border-0 border-t border-solid border-neutral-200 py-4 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-x-5">
      <div className="row-span-2 flex min-w-0 flex-col items-start leading-tight">
        {grant.deadline ? (
          <time dateTime={grant.deadline} className="font-semibold tabular-nums text-foundy-primary-ink">
            <span className="text-[24px]">{Number(grant.deadline.slice(8))}</span>일
          </time>
        ) : "미정"}
        {deadline && <span className="mt-1 text-[13px] font-medium text-neutral-600 [overflow-wrap:anywhere]">{deadline}</span>}
      </div>
      <div className="min-w-0">
        <GrantEligibility label={label} tone={tone} organization={org} />
        <h4 className="mb-0 mt-1.5 break-keep text-base font-semibold leading-snug text-neutral-900 [overflow-wrap:anywhere]">{title}</h4>
        <p className="mb-0 mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] leading-relaxed text-neutral-600">
          <span className="break-keep font-medium text-neutral-800 [overflow-wrap:anywhere]"><span className="sr-only">지원 규모 </span>{grant.amount}</span>
        </p>
      </div>
      <div className="col-start-2 sm:col-start-auto sm:self-center">
        <GrantCardActions id={grant.id} title={title} />
      </div>
    </article>
  );
}
