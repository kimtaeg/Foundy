"use client";
import { Suspense } from "react";
import { GrantFiltersBar } from "@/components/grants/GrantFiltersBar";
import { GrantRefreshControl } from "@/components/grants/GrantRefreshControl";
import { GrantResults } from "@/components/grants/GrantResults";
import { GrantStatusFilter } from "@/components/grants/GrantStatusFilter";
import { GrantsHeader } from "@/components/grants/GrantsHeader";
import { GrantsSkeleton } from "@/components/grants/GrantsSkeleton";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataViewProps } from "@/types/data-state";
import type { GrantsViewData } from "@/types/grant-view";

export interface GrantsViewProps extends DataViewProps<GrantsViewData> {
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshError?: string;
}

export function GrantsView({ onEvent, onRefresh, refreshing = false, refreshError, ...state }: GrantsViewProps) {
  return (
    <FeatureView page="grants" onEvent={onEvent}>
      <DataBoundary {...state} fallback={<GrantsSkeleton />}>
        {({ filters, categories, grants, overview, sourceLabel, status }) => (
          <>
            <GrantsHeader sourceLabel={sourceLabel} nextDeadline={overview?.nextDeadline} />
            <div className="pb-7 sm:pb-8">
              <GrantStatusFilter selected={filters.res} counts={overview?.counts} />
            </div>
            <section aria-labelledby="grant-results-title" className="border-0 border-t border-solid border-neutral-200 pt-6 sm:pt-8">
              <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h2 id="grant-results-title" className="m-0 text-lg font-semibold tracking-tight sm:text-2xl">지원사업 공고</h2>
                <span aria-live="polite" aria-atomic="true" className="text-base font-medium tabular-nums text-foundy-primary-ink">{grants.length}건</span>
              </div>
              <GrantFiltersBar filters={filters} categories={categories}>
                {onRefresh && <GrantRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              </GrantFiltersBar>
              {refreshError && <p role="alert" className="mb-0 mt-3 text-sm leading-6 text-red-700">{refreshError}</p>}
              <div className="mt-5 sm:mt-6" aria-busy={refreshing || undefined}>
                <Suspense fallback={<SectionSkeleton appearance="plain" variant="list" label="지원사업 목록" />}>
                  {refreshing && !grants.length ? (
                    <SectionSkeleton appearance="plain" variant="list" label="지원사업 공고를 조회하는 중" />
                  ) : (
                    <GrantResults grants={grants} status={status} />
                  )}
                </Suspense>
              </div>
            </section>
          </>
        )}
      </DataBoundary>
    </FeatureView>
  );
}
