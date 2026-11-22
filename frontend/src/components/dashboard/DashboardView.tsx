"use client";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardBentoGrid } from "@/components/dashboard/DashboardBentoGrid";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DashboardHeaderSkeleton } from "@/components/dashboard/DashboardHeaderSkeleton";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataState, DataViewProps } from "@/types/data-state";
import type { DashboardViewData } from "@/types/dashboard";
import type { DashboardPopulationSnapshot } from "@/types/dashboard-population";

export interface DashboardViewProps extends DataViewProps<DashboardViewData> {
  population?: DataState<DashboardPopulationSnapshot>;
}

export function DashboardView({ onEvent, population, ...state }: DashboardViewProps) {
  return (
    <DataBoundary {...state} fallback={<DashboardSkeleton />}>
      {(dashboard) => (
        <FeatureView page="dashboard" onEvent={onEvent}>
          <Suspense fallback={<DashboardHeaderSkeleton />}>
            <DashboardHeader
              store={dashboard.store}
              name={dashboard.name}
              days={dashboard.days}
              undecided={dashboard.undecided}
            />
          </Suspense>
          <DashboardBentoGrid dashboard={dashboard} population={population} />
        </FeatureView>
      )}
    </DataBoundary>
  );
}
