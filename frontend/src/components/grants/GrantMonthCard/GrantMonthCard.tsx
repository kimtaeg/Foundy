import { GrantDeadlineRow } from "@/components/grants/GrantDeadlineRow";
import type { GrantMonthViewData } from "@/types/grant-view";

export interface GrantMonthCardProps {
  group: GrantMonthViewData;
}

export function GrantMonthCard({ group }: GrantMonthCardProps) {
  const [year, month] = group.month.split("-");
  return (
    <section className="grid gap-3 border-0 border-t border-solid border-neutral-200 py-5 sm:py-6 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-8">
      <h3 className="m-0 text-lg font-semibold leading-snug tracking-tight text-neutral-900 sm:text-xl">
        <time dateTime={group.month}>{year}년 {Number(month)}월</time>
      </h3>
      <div className="min-w-0">
        {group.grants.map((item) => (
          <GrantDeadlineRow key={item.grant.id} {...item} />
        ))}
      </div>
    </section>
  );
}
