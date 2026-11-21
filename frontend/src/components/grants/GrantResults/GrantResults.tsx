import { Suspense } from "react";
import { GrantCard } from "@/components/grants/GrantCard";
import { GrantListRow } from "@/components/grants/GrantListRow";
import { GrantMonthCard } from "@/components/grants/GrantMonthCard";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { Element } from "@/components/view/Element";
import type { GrantMonthViewData, GrantViewItem } from "@/types/grant-view";
import type { GrantFilters } from "@/types/grants";

export interface GrantResultsProps {
  grants: GrantViewItem[];
  months: GrantMonthViewData[];
  view: GrantFilters["view"];
}

export function GrantResults({ grants, months, view }: GrantResultsProps) {
  if (view === "card")
    return (
      <Element className="nx-ggrid">
        {grants.map((item) => (
          <Suspense key={item.grant.id} fallback={<SectionSkeleton variant="card" label="지원사업 공고" />}>
            <GrantCard {...item} />
          </Suspense>
        ))}
      </Element>
    );
  if (view === "list")
    return (
      <Element as="section" className="nx-card">
        {grants.map((item) => (
          <Suspense key={item.grant.id} fallback={<SectionSkeleton variant="list" rows={1} label="지원사업 공고" />}>
            <GrantListRow {...item} />
          </Suspense>
        ))}
      </Element>
    );
  return (
    <>
      {months.length ? (
        months.map((group) => (
          <Suspense key={group.month} fallback={<SectionSkeleton variant="list" label="월별 지원사업" />}>
            <GrantMonthCard group={group} />
          </Suspense>
        ))
      ) : (
        <Element className="nx-empty">마감일이 있는 공고가 없어요.</Element>
      )}
    </>
  );
}
