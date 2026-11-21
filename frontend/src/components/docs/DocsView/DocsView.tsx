"use client";
import { Suspense } from "react";
import { DocsHeader } from "@/components/docs/DocsHeader";
import { DocsSummary } from "@/components/docs/DocsSummary";
import { DocTaskCard } from "@/components/docs/DocTaskCard";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { Element } from "@/components/view/Element";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataViewProps } from "@/types/data-state";
import type { DocsViewData } from "@/types/documents";

export type DocsViewProps = DataViewProps<DocsViewData>;

export function DocsView({ onEvent, ...state }: DocsViewProps) {
  return (
    <FeatureView page="docs" onEvent={onEvent}>
      <DocsHeader />
      <DataBoundary {...state} fallback={<PageSkeleton page="docs" />}>
        {(model) => (
          <Element className="nx-wrap">
            <Element className="nx-note">
              정부 서식은 해당 사이트에서만 효력이 있어요. 링크는 공식 사이트 첫
              화면이고, 찾는 방법은 각 서류 아래에 적어 뒀어요. 발급·제출은 직접
              해야 해요.
            </Element>
            <Suspense fallback={<SectionSkeleton variant="card" label="서류 준비 현황" />}>
              <DocsSummary total={model.total} finished={model.finished} remaining={model.remaining} />
            </Suspense>
            {model.rows.map((row) => (
              <Suspense key={row.task.id} fallback={<SectionSkeleton variant="list" label="준비 서류" />}>
                <DocTaskCard row={row} contacts={model.contacts} />
              </Suspense>
            ))}
          </Element>
        )}
      </DataBoundary>
    </FeatureView>
  );
}
