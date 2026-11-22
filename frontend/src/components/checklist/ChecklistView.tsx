"use client";
import { Suspense, useState } from "react";
import { CalendarAgendaCard } from "@/components/checklist/CalendarAgendaCard";
import { CalendarMonthCard } from "@/components/checklist/CalendarMonthCard";
import { ChecklistHeader } from "@/components/checklist/ChecklistHeader";
import { ChecklistProgress } from "@/components/checklist/ChecklistProgress";
import { ChecklistSkeleton } from "@/components/checklist/ChecklistSkeleton";
import { ChecklistTaskFilter } from "@/components/checklist/ChecklistTaskFilter";
import { ChecklistTaskList } from "@/components/checklist/ChecklistTaskList";
import { ChecklistViewTabs } from "@/components/checklist/ChecklistViewTabs";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { FeatureView } from "@/components/view/FeatureView";
import type {
  ChecklistTaskFilter as TaskFilter,
  ChecklistViewData,
} from "@/types/checklist";
import type { DataViewProps } from "@/types/data-state";

export type ChecklistViewProps = DataViewProps<ChecklistViewData>;

export function ChecklistView({ onEvent, ...state }: ChecklistViewProps) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  return (
    <DataBoundary {...state} fallback={<ChecklistSkeleton />}>
      {(checklist) => (
        <FeatureView page="checklist" onEvent={onEvent}>
          <ChecklistHeader />
          <ChecklistProgress opening={checklist.opening} {...checklist.count} />
          <div
            data-testid="checklist-toolbar"
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4 sm:py-6"
          >
            <ChecklistViewTabs view={checklist.view} />
            {checklist.view !== "calendar" && (
              <ChecklistTaskFilter value={filter} onChange={setFilter} />
            )}
          </div>
          <h2 className="sr-only">
            {checklist.view === "calendar" ? "준비 일정" : "준비 항목"}
          </h2>
          {checklist.view === "calendar" ? (
            <div className="grid min-w-0 gap-10 border-0 border-t border-solid border-neutral-200 pt-7 xl:grid-cols-12 xl:gap-12">
              <div className="min-w-0 xl:col-span-7">
                <Suspense
                  fallback={
                    <SectionSkeleton
                      appearance="plain"
                      variant="table"
                      label="월간 일정"
                    />
                  }
                >
                  <CalendarMonthCard
                    year={checklist.calendar.year}
                    month={checklist.calendar.month}
                    days={checklist.calendar.days}
                    colors={checklist.colors}
                  />
                </Suspense>
              </div>
              <div className="min-w-0 xl:col-span-5">
                <Suspense
                  fallback={
                    <SectionSkeleton
                      appearance="plain"
                      variant="list"
                      label="선택한 날짜의 일정"
                    />
                  }
                >
                  <CalendarAgendaCard
                    selected={checklist.calendar.selected}
                    events={checklist.calendar.selectedEvents}
                    colors={checklist.colors}
                  />
                </Suspense>
              </div>
            </div>
          ) : (
            <Suspense
              fallback={
                <SectionSkeleton
                  appearance="plain"
                  variant="list"
                  label="준비 항목"
                />
              }
            >
              <ChecklistTaskList groups={checklist.groups} filter={filter} />
            </Suspense>
          )}
          {!checklist.employees && (
            <p className="mb-0 mt-8 text-[13px] leading-relaxed text-neutral-600">
              직원 고용 계획이 없어 고용 관련 항목은 표시하지 않아요.
            </p>
          )}
        </FeatureView>
      )}
    </DataBoundary>
  );
}
