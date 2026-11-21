"use client";
import { Suspense } from "react";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { LockedReport } from "@/components/report/LockedReport";
import { ReportCard } from "@/components/report/ReportCard";
import { ReportFilters } from "@/components/report/ReportFilters";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ObligationsSection } from "@/components/report/ObligationsSection";
import { ReportSummary } from "@/components/report/ReportSummary";
import { Element } from "@/components/view/Element";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataViewProps } from "@/types/data-state";
import type { ReportViewData } from "@/types/report";

export type ReportViewProps = DataViewProps<ReportViewData>;

export function ReportView({ onEvent, ...state }: ReportViewProps) {
  return (
    <DataBoundary {...state} fallback={<PageSkeleton page="report" />}>
      {(report) => (
        <FeatureView page="report" onEvent={onEvent}>
          <ReportHeader locked={report.locked} live={report.live} exampleCount={report.exampleItems?.length ?? 0} />
          {report.locked ? (
            <LockedReport />
          ) : (
            <>
              {(report.exampleItems?.length ?? 0) > 0 && (
                <Element className="nx-note" role="status">
                  <b>예시 자료 기준이에요.</b> 아래 항목은 실제 조회가 아니라 예시 자료로 판정했어요. 실제 결과와 다를 수 있으니 관할 기관에 확인하세요.
                  <ul className="nx-ul">
                    {report.exampleItems?.map((title) => (
                      <li key={title}>{title}</li>
                    ))}
                  </ul>
                </Element>
              )}
              <Suspense fallback={<SectionSkeleton label="점검 요약" />}>
                <ReportSummary counts={report.counts} firstByVerdict={report.firstByVerdict} />
              </Suspense>
              <ReportFilters selected={report.filter} />
              <Element className="nx-wrap">
                {report.cards.length ? (
                  report.cards.map((model) => (
                    <Suspense key={model.card.id} fallback={<SectionSkeleton label={model.card.title} />}>
                      <ReportCard model={model} />
                    </Suspense>
                  ))
                ) : (
                  <Element className="nx-empty">해당 단계의 결과가 없어요.</Element>
                )}
                <ObligationsSection items={report.obligations} />
                <Element className="nx-note">
                  법률 자문이 아닌 사전 점검입니다. 계약·신고 전에는 관할 기관에 확인하세요.
                </Element>
              </Element>
            </>
          )}
        </FeatureView>
      )}
    </DataBoundary>
  );
}
