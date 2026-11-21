"use client";
import { Suspense } from "react";
import { CalendarAgendaCard } from "@/components/checklist/CalendarAgendaCard";
import { CalendarMonthCard } from "@/components/checklist/CalendarMonthCard";
import { ChecklistHeader } from "@/components/checklist/ChecklistHeader";
import { ChecklistProgress } from "@/components/checklist/ChecklistProgress";
import { ChecklistViewTabs } from "@/components/checklist/ChecklistViewTabs";
import { TaskGroupCard } from "@/components/checklist/TaskGroupCard";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { Element } from "@/components/view/Element";
import { FeatureView } from "@/components/view/FeatureView";
import type { ChecklistViewData } from "@/types/checklist";
import type { DataViewProps } from "@/types/data-state";

export type ChecklistViewProps = DataViewProps<ChecklistViewData>;

export function ChecklistView({ onEvent, ...state }: ChecklistViewProps) {
  return (
    <DataBoundary {...state} fallback={<PageSkeleton page="checklist" />}>
      {(checklist) => (
        <FeatureView page="checklist" onEvent={onEvent}>
          <ChecklistHeader />
          <Element className="nx-wrap">
            <Suspense fallback={<SectionSkeleton label="체크리스트 진행 현황" />}>
              <ChecklistProgress opening={checklist.opening} {...checklist.count} kinds={checklist.kinds} reviewCount={checklist.reviewCount} />
            </Suspense>
            <ChecklistViewTabs view={checklist.view} />
            {!checklist.employees && (
              <Element className="nx-note">
                직원을 고용하지 않아서 고용 카테고리는 숨겼어요.
              </Element>
            )}
            {checklist.view === "calendar" ? (
              <Element className="nx-calwrap">
                <Suspense fallback={<SectionSkeleton variant="table" label="월간 일정" />}>
                  <CalendarMonthCard
                    year={checklist.calendar.year}
                    month={checklist.calendar.month}
                    days={checklist.calendar.days}
                    colors={checklist.colors}
                  />
                </Suspense>
                <Suspense fallback={<SectionSkeleton variant="list" label="선택한 날짜의 일정" />}>
                  <CalendarAgendaCard
                    selected={checklist.calendar.selected}
                    events={checklist.calendar.selectedEvents}
                    colors={checklist.colors}
                  />
                </Suspense>
              </Element>
            ) : (
              checklist.groups.map((group) => (
                <Suspense key={group.title} fallback={<SectionSkeleton variant="list" label={group.title} />}>
                  <TaskGroupCard group={group} />
                </Suspense>
              ))
            )}
          </Element>
        </FeatureView>
      )}
    </DataBoundary>
  );
}
