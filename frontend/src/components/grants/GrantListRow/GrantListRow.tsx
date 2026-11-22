import { GrantCardActions } from "@/components/grants/GrantCardActions";
import { GrantEligibility } from "@/components/grants/GrantEligibility";
import { grantDisplay } from "@/lib/grants/format-grant";
import type { Grant } from "@/types/grants";

export interface GrantListRowProps {
  grant: Grant;
  label: string;
  tone: string;
  deadline: string;
}

export function GrantListRow({ grant, label, tone, deadline }: GrantListRowProps) {
  const { title, org } = grantDisplay(grant);
  return (
    <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-0 border-b border-solid border-neutral-200 py-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.85fr)_auto_auto] md:gap-x-6">
      <header className="col-span-full min-w-0 md:col-span-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <GrantEligibility label={label} tone={tone} organization={org} />
          <span className="text-[13px] text-neutral-600">{grant.cat}</span>
        </div>
        <h3 className="mb-0 mt-1.5 break-keep text-base font-semibold leading-snug text-neutral-900 [overflow-wrap:anywhere]">{title}</h3>
        <p className="mb-0 mt-0.5 text-[13px] text-neutral-600">{grant.region}</p>
      </header>
      <p className="col-start-1 row-start-2 m-0 break-keep text-base font-semibold leading-snug text-foundy-primary-ink [overflow-wrap:anywhere] md:col-auto md:row-auto">
        <span className="sr-only">지원 규모 </span>{grant.amount}
      </p>
      <p className="col-start-1 row-start-3 m-0 flex flex-wrap items-baseline gap-x-2 text-[13px] text-neutral-600 md:col-auto md:row-auto md:flex-col md:gap-y-0.5 md:text-right">
        <span className="sr-only">마감 </span>
        {grant.deadline ? (
          <>
            <time dateTime={grant.deadline} className="font-medium tabular-nums text-neutral-800">{grant.deadline.replaceAll("-", ".")}</time>
            {deadline && <span>{deadline}</span>}
          </>
        ) : "일정 미정"}
      </p>
      <div className="col-start-2 row-span-2 row-start-2 justify-self-end md:col-auto md:row-auto">
        <GrantCardActions id={grant.id} title={title} />
      </div>
    </article>
  );
}
