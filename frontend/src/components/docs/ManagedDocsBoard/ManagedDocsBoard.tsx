"use client";
import { useState } from "react";
import { DocSectionCard } from "@/components/docs/DocSectionCard";
import { DocStatusTabs } from "@/components/docs/DocStatusTabs";
import { DocsProgressSummary } from "@/components/docs/DocsProgressSummary";
import { Element } from "@/components/view/Element";
import { DOC_FILTER_MATCH } from "@/data/documents";
import type { DocFilter, ManagedDocsData } from "@/types/documents";

export interface ManagedDocsBoardProps {
  data: ManagedDocsData;
}

/** 서류별 상태를 관리하는 서류함 (서버 연결 모드). 보기 필터는 이 화면 안에서만 쓴다. */
export function ManagedDocsBoard({ data }: ManagedDocsBoardProps) {
  const [filter, setFilter] = useState<DocFilter>("all");
  const all = data.sections.flatMap((section) => section.documents);
  const counts = Object.fromEntries(
    (Object.keys(DOC_FILTER_MATCH) as DocFilter[]).map((key) => [
      key,
      all.filter((doc) => DOC_FILTER_MATCH[key](doc.status)).length,
    ]),
  ) as Record<DocFilter, number>;
  const sections = data.sections
    .map((section) => ({
      ...section,
      documents: section.documents.filter((doc) => DOC_FILTER_MATCH[filter](doc.status)),
    }))
    .filter((section) => section.documents.length);
  return (
    <>
      <DocsProgressSummary data={data} />
      <DocStatusTabs filter={filter} counts={counts} onChange={setFilter} />
      {sections.length === 0 && <Element className="nx-empty">이 상태의 서류가 없어요.</Element>}
      {sections.map((section) => (
        <DocSectionCard key={section.title} section={section} />
      ))}
    </>
  );
}
