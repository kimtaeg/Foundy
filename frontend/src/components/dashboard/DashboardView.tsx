"use client";
import { Suspense } from "react";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { DecisionList } from "@/components/dashboard/DecisionList";
import { StoreSummary } from "@/components/dashboard/StoreSummary";
import { TaskList } from "@/components/dashboard/TaskList";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { Element } from "@/components/view/Element";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataViewProps } from "@/types/data-state";
import type { DashboardViewData } from "@/types/dashboard";

export type DashboardViewProps = DataViewProps<DashboardViewData>;

export function DashboardView({ onEvent, ...state }: DashboardViewProps) {
  return (
    <DataBoundary {...state} fallback={<PageSkeleton page="dashboard" />}>
      {(dashboard) => (
        <FeatureView page="dashboard" onEvent={onEvent}>
          <Element className="nx-wrap">
            <Suspense fallback={<SectionSkeleton label="가게 요약" />}>
              <StoreSummary
                store={dashboard.store}
                name={dashboard.name}
                days={dashboard.days}
                undecided={dashboard.undecided}
              />
            </Suspense>
            {dashboard.undecided && (
              <Element className="nx-note">
                자리를 정하면 점검 리포트(건물 용도·위반건축물·상표)가 시작돼요.
                먼저 상권을 비교해 자리를 정해 보세요.
              </Element>
            )}
            <Suspense fallback={<SectionSkeleton label="준비 현황" />}>
              <DashboardMetrics
                undecided={dashboard.undecided}
                decisions={dashboard.decisions.length}
                tasks={dashboard.taskCount}
                unread={dashboard.unread}
              />
            </Suspense>
            <Element className="nx-grid2">
              <Suspense fallback={<SectionSkeleton variant="list" label="결정할 사항" />}>
                <DecisionList cards={dashboard.decisions} undecided={dashboard.undecided} />
              </Suspense>
              <Suspense fallback={<SectionSkeleton variant="list" label="할 일" />}>
                <TaskList actions={dashboard.actions} tasks={dashboard.tasks} />
              </Suspense>
            </Element>
          </Element>
        </FeatureView>
      )}
    </DataBoundary>
  );
}
