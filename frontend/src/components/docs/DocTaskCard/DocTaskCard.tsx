"use client";

import { useState } from "react";
import { DocRow } from "@/components/docs/DocRow";
import type { DocumentTaskViewData } from "@/types/documents";

export interface DocTaskCardProps {
  row: DocumentTaskViewData;
  expandedDocumentId?: string | null;
  onExpandedDocumentChange?: (documentId: string | null) => void;
}

const metadataBadge = "rounded-md bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700";

export function DocTaskCard({ row, expandedDocumentId, onExpandedDocumentChange }: DocTaskCardProps) {
  const { task, documents, deadline } = row;
  const titleId = `doc-title-${task.id}`;
  const [localDocumentId, setLocalDocumentId] = useState<string | null>(null);
  const activeId = expandedDocumentId === undefined ? localDocumentId : expandedDocumentId;

  function changeDocument(id: string | null) {
    if (expandedDocumentId === undefined) setLocalDocumentId(id);
    onExpandedDocumentChange?.(id);
  }

  return (
    <section
      id={`doc-${task.id}`}
      aria-labelledby={titleId}
      className="flex min-w-0 scroll-mt-36 flex-col gap-2 border-0 border-t border-solid border-neutral-200 pb-1 pt-4 sm:pb-2 sm:pt-5 xl:scroll-mt-24"
    >
      <header className="flex min-w-0 flex-col items-start gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${task.done ? "bg-foundy-primary/10 text-foundy-primary-ink" : "bg-neutral-100 text-neutral-700"}`}>
          {task.done ? "항목 완료" : "남은 일"}
        </span>
        <h3 id={titleId} className="m-0 break-keep text-lg leading-snug font-semibold tracking-tight text-neutral-900 [overflow-wrap:anywhere] sm:text-xl">
          {task.task}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-neutral-600">
          {task.group && <span className={metadataBadge}>{task.group}</span>}
          {task.category && <span className={metadataBadge}>{task.category}</span>}
          {!task.done && deadline && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700 tabular-nums">{deadline}</span>
          )}
          {task.due && (
            <time dateTime={task.due} className="whitespace-nowrap tabular-nums">예정 {task.due.replaceAll("-", ".")}</time>
          )}
        </div>
      </header>
      <div role="group" aria-label="필요 서류" className="flex min-w-0 flex-wrap items-start gap-x-4">
        {documents.map((document) => (
          <DocRow key={document.id} document={document} compact={documents.length > 1}
            expanded={activeId === document.id} onExpandedChange={(open) => changeDocument(open ? document.id : null)} />
        ))}
      </div>
    </section>
  );
}
