"use client";
import { Suspense } from "react";
import { GrantFiltersBar } from "@/components/grants/GrantFiltersBar";
import { GrantResults } from "@/components/grants/GrantResults";
import { GrantsHeader } from "@/components/grants/GrantsHeader";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { Element } from "@/components/view/Element";
import { FeatureView } from "@/components/view/FeatureView";
import { grantBadge, grantNote } from "@/lib/grants/grant-status";
import type { DataViewProps } from "@/types/data-state";
import type { GrantsViewData } from "@/types/grant-view";

export type GrantsViewProps = DataViewProps<GrantsViewData>;

export function GrantsView({ onEvent, ...state }: GrantsViewProps) {
  const resolved = state.data && !(state.data instanceof Promise) ? state.data : null;
  return (
    <FeatureView page="grants" onEvent={onEvent}>
      <GrantsHeader badge={grantBadge(resolved?.status ?? null)} />
      <DataBoundary {...state} fallback={<PageSkeleton page="grants" />}>
        {(model) => (
          <Element className="nx-wrap">
            {grantNote(model.status) && <Element className="nx-note">{grantNote(model.status)}</Element>}
            <GrantFiltersBar filters={model.filters} categories={model.categories} />
            <Suspense fallback={<SectionSkeleton variant="list" label="지원사업 목록" />}>
              <GrantResults grants={model.grants} months={model.months} view={model.filters.view} />
            </Suspense>
            <Element className="nx-note">
              조건이 명확히 맞지 않아 제외한 공고 {model.excludedCount}건은
              목록에서 뺐어요. 신청 전 공고 원문과 주관 기관을 확인하세요.
            </Element>
          </Element>
        )}
      </DataBoundary>
    </FeatureView>
  );
}
