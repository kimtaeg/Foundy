import { Suspense } from "react";
import { PreparationProgressCard } from "@/components/dashboard/PreparationProgressCard";
import { PriorityDecisionCard } from "@/components/dashboard/PriorityDecisionCard";
import { UpcomingTasksCard } from "@/components/dashboard/UpcomingTasksCard";
import { PopulationSnapshotCard } from "@/components/dashboard/PopulationSnapshotCard";
import { OpeningScheduleCard } from "@/components/dashboard/OpeningScheduleCard";
import { DashboardSectionDivider } from "@/components/dashboard/DashboardSectionDivider";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { DashboardViewData } from "@/types/dashboard";
import type { DashboardPopulationSnapshot } from "@/types/dashboard-population";
import type { DataState } from "@/types/data-state";

export interface DashboardBentoGridProps {
  dashboard: DashboardViewData;
  population?: DataState<DashboardPopulationSnapshot>;
}

export function DashboardBentoGrid({ dashboard, population }: DashboardBentoGridProps) {
  return (
    <div data-testid="dashboard-bento" className="relative grid grid-cols-1 gap-8 max-sm:gap-12 md:grid-cols-2 lg:gap-12 xl:grid-cols-12">
      <Suspense fallback={<SectionSkeleton appearance="plain" rows={1} label="개업 일정" className="min-h-24 md:col-span-2 xl:col-span-12" />}>
        <OpeningScheduleCard opening={dashboard.store.opening} days={dashboard.days} asOf={dashboard.asOf} tasks={dashboard.timelineTasks ?? dashboard.tasks} className="md:col-span-2 xl:col-span-12" />
      </Suspense>
      <Suspense fallback={<SectionSkeleton appearance="plain" variant="chart" label="준비 현황" className="md:col-span-2 xl:col-span-7" />}>
        <PreparationProgressCard count={dashboard.taskCount} stages={dashboard.stages} className="md:col-span-2 xl:col-span-7" />
      </Suspense>
      <div className="relative min-w-0 xl:col-span-5">
        <DashboardSectionDivider className="absolute inset-x-0 -top-4 -translate-y-1/2 max-sm:-top-6 lg:-top-6 lg:w-[calc(200%+3rem)] xl:hidden" />
        <Suspense fallback={<SectionSkeleton appearance="plain" variant="list" label="결정할 사항" />}>
          <PriorityDecisionCard cards={dashboard.decisions} undecided={dashboard.undecided} counts={dashboard.reportCounts} sourceLabel={dashboard.reportSourceLabel} />
        </Suspense>
      </div>
      <DashboardSectionDivider className="absolute inset-x-0 -top-6 hidden -translate-y-1/2 xl:col-span-full xl:row-start-3 xl:block" />
      <div className="relative min-w-0 xl:col-span-7">
        <DashboardSectionDivider className="absolute inset-x-0 -top-4 -translate-y-1/2 max-sm:-top-6 lg:hidden" />
        <Suspense fallback={<SectionSkeleton appearance="plain" variant="list" label="다음 할 일" />}>
          <UpcomingTasksCard tasks={dashboard.tasks} actions={dashboard.actions} asOf={dashboard.asOf} />
        </Suspense>
      </div>
      <div className="relative flex min-w-0 flex-col md:col-span-2 xl:col-span-5">
        <DashboardSectionDivider className="absolute inset-x-0 -top-4 -translate-y-1/2 max-sm:-top-6 lg:-top-6 xl:hidden" />
        {population ? (
          <DataBoundary {...population} fallback={<SectionSkeleton appearance="plain" variant="chart" label="생활인구를 불러오는 중" className="min-h-80" />}>
            {(data) => <PopulationSnapshotCard data={data} />}
          </DataBoundary>
        ) : <PopulationSnapshotCard />}
      </div>
    </div>
  );
}
