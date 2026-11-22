"use client";
import { DOCUMENT_SITES, documentsOf } from "@/data/documents";
import { useFeatureData } from "@/hooks/useFeatureData";
import type { DocsViewData, DocumentTaskViewData } from "@/types/documents";

export function useDocs(): DocsViewData | null {
  const { context, api, apiActive } = useFeatureData("docs");
  if (apiActive) return api?.docsView ?? null;
  if (!context) return null;
  const rows: DocumentTaskViewData[] = context
    .allTasks()
    .map((task) => ({
      task,
      deadline: context.dday(task.due),
      documents: documentsOf(task.id).map((document) => ({
        ...document,
        sites: document.sites.flatMap((key) => {
          const site = DOCUMENT_SITES[key];
          return site ? [{ ...site }] : [];
        }),
      })),
    }))
    .filter((row) => row.documents.length);
  const total = rows.reduce((sum, row) => sum + row.documents.length, 0);
  const finished = rows
    .filter((row) => row.task.done)
    .reduce((sum, row) => sum + row.documents.length, 0);
  return {
    rows,
    total,
    finished,
    remaining: total - finished,
  };
}
