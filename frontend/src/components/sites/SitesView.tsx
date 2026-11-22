"use client";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SitesSkeleton } from "@/components/sites/SitesSkeleton";
import { SitesWorkspace } from "@/components/sites/SitesWorkspace";
import type { DataState } from "@/types/data-state";
import type { SitesDataServices, SitesViewData } from "@/types/market";

export interface SitesViewProps extends DataState<SitesViewData>, SitesDataServices {}

/** API response and callbacks are sufficient; no FoundyProvider is required. */
export function SitesView({ data, loading, error, onRetry, ...services }: SitesViewProps) {
  return (
    <DataBoundary data={data} loading={loading} error={error} onRetry={onRetry} fallback={<SitesSkeleton />}>
      {(resolved) => <SitesWorkspace data={resolved} {...services} />}
    </DataBoundary>
  );
}
