"use client";

import { Suspense, useState } from "react";
import { ChecklistTaskFilter } from "@/components/checklist/ChecklistTaskFilter";
import { DocTaskCard } from "@/components/docs/DocTaskCard";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { ChecklistTaskFilter as TaskFilter } from "@/types/checklist";
import type { DocsViewData } from "@/types/documents";

export type DocsDirectoryProps = Pick<DocsViewData, "rows">;

export function DocsDirectory({ rows }: DocsDirectoryProps) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [expanded, setExpanded] = useState<{ taskId: string; documentId: string } | null>(null);
  const visible = rows.filter(({ task }) => filter === "all" || task.done === (filter === "done"));
  return (
    <section aria-labelledby="docs-directory-title" className="min-w-0 pt-7 sm:pt-8">
      <header className="flex items-center justify-between gap-3 pb-4 sm:gap-6 sm:pb-5">
        <div className="min-w-0">
          <h2 id="docs-directory-title" className="m-0 min-w-0 break-keep text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
            항목별 발급 안내
          </h2>
          <p className="mb-0 mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
            발급처 링크는 공식 사이트 첫 화면으로 열려요. 서류별 안내를 따라 직접 발급·제출하세요.
          </p>
        </div>
        <ChecklistTaskFilter value={filter} onChange={setFilter} />
      </header>
      {visible.map((row) => (
        <Suspense key={row.task.id} fallback={<SectionSkeleton appearance="plain" variant="list" label="준비 서류" className="py-6" />}>
          <DocTaskCard
            row={row}
            expandedDocumentId={expanded?.taskId === row.task.id ? expanded.documentId : null}
            onExpandedDocumentChange={(documentId) => setExpanded(documentId === null ? null : { taskId: row.task.id, documentId })}
          />
        </Suspense>
      ))}
      {visible.length === 0 && (
        <p role="status" className="m-0 border-0 border-t border-solid border-neutral-200 py-12 text-center text-base text-neutral-600">
          {rows.length === 0 ? "준비할 서류가 아직 없어요." : filter === "done" ? "완료한 항목에 연결된 서류가 없어요." : "남은 항목에 연결된 서류가 없어요."}
        </p>
      )}
    </section>
  );
}
