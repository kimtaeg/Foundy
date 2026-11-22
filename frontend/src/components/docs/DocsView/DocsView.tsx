"use client";
import { DocsDirectory } from "@/components/docs/DocsDirectory";
import { DocsHeader } from "@/components/docs/DocsHeader";
import { DocsSkeleton } from "@/components/docs/DocsSkeleton";
import { DocsSummary } from "@/components/docs/DocsSummary";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataViewProps } from "@/types/data-state";
import type { DocsViewData } from "@/types/documents";

export type DocsViewProps = DataViewProps<DocsViewData>;

export function DocsView({ onEvent, ...state }: DocsViewProps) {
  return (
    <FeatureView page="docs" onEvent={onEvent}>
      <DocsHeader />
      <DataBoundary {...state} fallback={<DocsSkeleton />}>
        {({ total, finished, remaining, rows, summaryBasis }) => (
          <>
            <DocsSummary summaryBasis={summaryBasis} total={total} finished={finished} remaining={remaining} />
            <DocsDirectory rows={rows} />
          </>
        )}
      </DataBoundary>
    </FeatureView>
  );
}
