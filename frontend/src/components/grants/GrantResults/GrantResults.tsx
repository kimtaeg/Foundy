import { Suspense } from "react";
import { GrantCard } from "@/components/grants/GrantCard";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { GrantsViewData, GrantViewItem } from "@/types/grant-view";

export interface GrantResultsProps {
  grants: GrantViewItem[];
  status?: GrantsViewData["status"];
}

const emptyStyle = "m-0 border-0 border-y border-solid border-neutral-200 py-9 text-center text-[15px] text-neutral-600";
const emptyMessages = {
  ready: "선택한 조건에 맞는 공고가 없어요.",
  empty: "표시할 지원사업 공고가 없어요. 모집 중인 공고를 조회해 보세요.",
  unavailable: "지원사업 공고를 불러오지 못했어요.",
};

export function GrantResults({ grants, status = "ready" }: GrantResultsProps) {
  if (!grants.length) return <p className={emptyStyle}>{emptyMessages[status]}</p>;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3 xl:gap-x-8">
      {grants.map((item) => (
        <Suspense key={item.grant.id} fallback={<SectionSkeleton appearance="plain" variant="card" label="지원사업 공고" />}>
          <GrantCard {...item} />
        </Suspense>
      ))}
    </div>
  );
}
