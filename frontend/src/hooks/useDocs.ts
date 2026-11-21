"use client";
import { DOCUMENT_SITES, documentsOf } from "@/data/documents";
import { useFeatureData } from "@/hooks/useFeatureData";
import type { DocsViewData, DocumentTaskViewData } from "@/types/documents";

export function useDocs(): DocsViewData | null {
  const { context } = useFeatureData("docs");
  if (!context) return null;
  const rows: DocumentTaskViewData[] = context
    .allTasks()
    .map((task) => ({
      task,
      deadline: context.dday(task.due),
      // 서버 데이터면 응답의 서류·링크를 그대로 쓰고, 로컬 예시면 정적 서류 목록을 쓴다.
      documents:
        "documentsOf" in context && typeof context.documentsOf === "function"
          ? context.documentsOf(task.id)
          : documentsOf(task.id).map((document) => ({
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
    contacts: context.CONTACT,
  };
}
