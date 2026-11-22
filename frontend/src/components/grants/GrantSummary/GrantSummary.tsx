import { GrantDeadline } from "@/components/grants/GrantDeadline";
import type { Grant } from "@/types/grants";

export interface GrantSummaryProps {
  grant: Grant;
}

export function GrantSummary({ grant }: GrantSummaryProps) {
  return (
    <div className="my-4 w-full">
      <p className="m-0 break-keep text-[22px] font-semibold leading-snug tracking-tight text-neutral-900 [overflow-wrap:anywhere]">
        <span className="sr-only">지원 규모 </span>{grant.amount}
      </p>
      <dl className="mb-0 mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm leading-relaxed">
        <dt className="text-neutral-600">대상</dt>
        <dd className="m-0 break-keep text-neutral-800 [overflow-wrap:anywhere]">{grant.who}</dd>
        <dt className="text-neutral-600">마감</dt>
        <dd className="m-0 text-neutral-800">
          <GrantDeadline date={grant.deadline} applicationPeriod={grant.applicationPeriod} />
        </dd>
      </dl>
    </div>
  );
}
