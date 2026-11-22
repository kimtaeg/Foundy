"use client";
import { Suspense } from "react";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { LockedReport } from "@/components/report/LockedReport";
import { ReportItems } from "@/components/report/ReportItems";
import { ReportFilters } from "@/components/report/ReportFilters";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ReportSkeleton } from "@/components/report/ReportSkeleton";
import { ReportSummary } from "@/components/report/ReportSummary";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataViewProps } from "@/types/data-state";
import type { ReportViewData } from "@/types/report";

export type ReportViewProps = DataViewProps<ReportViewData>;

export function ReportView({ onEvent, ...state }: ReportViewProps) {
  return (
    <DataBoundary {...state} fallback={<ReportSkeleton />}>
      {(report) => (
        <FeatureView page="report" onEvent={onEvent}>
          <ReportHeader locked={report.locked} />
          {report.locked ? (
            <LockedReport />
          ) : (
            <>
              <Suspense fallback={<SectionSkeleton appearance="plain" label="점검 요약" />}>
                <ReportSummary counts={report.counts} firstByVerdict={report.firstByVerdict} />
              </Suspense>
              <section aria-labelledby="report-items-title">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6 sm:py-8">
                  <h2 id="report-items-title" className="m-0 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">항목별 점검</h2>
                  <ReportFilters selected={report.filter} />
                </div>
                <ReportItems cards={report.cards} />
              </section>
              <p className="m-0 border-0 border-t border-solid border-neutral-200 pt-5 text-sm leading-relaxed text-neutral-600">
                법률 자문이 아닌 사전 점검입니다. 계약·신고 전에는 관할 기관에 확인하세요.
              </p>
            </>
          )}
        </FeatureView>
      )}
    </DataBoundary>
  );
}
