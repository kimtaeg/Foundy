import { GrantDeadlineRow } from "@/components/grants/GrantDeadlineRow";
import { Element } from "@/components/view/Element";
import type { GrantMonthViewData } from "@/types/grant-view";

export interface GrantMonthCardProps {
  group: GrantMonthViewData;
}

export function GrantMonthCard({ group }: GrantMonthCardProps) {
  return (
    <Element as="section" className="nx-card">
      <h3>{group.month.replace("-", "년 ")}월 마감</h3>
      {group.grants.map((item) => (
        <GrantDeadlineRow key={item.grant.id} {...item} />
      ))}
    </Element>
  );
}
