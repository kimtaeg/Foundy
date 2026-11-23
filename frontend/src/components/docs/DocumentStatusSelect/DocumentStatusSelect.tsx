"use client";

import { useState } from "react";
import { ListboxSelect } from "@/components/ui/ListboxSelect";
import type { ApiDocumentStatus } from "@/lib/api/types";

const labels = {
  not_started: "준비 전",
  in_progress: "준비 중",
  obtained: "발급·취득 완료",
  submitted: "제출 완료",
  needs_fix: "보완 필요",
  not_applicable: "해당 없음",
} satisfies Record<ApiDocumentStatus, string>;

const options = Object.entries(labels).map(([value, label]) => ({ value, label }));

export interface DocumentStatusSelectProps {
  id: string;
  name: string;
  status: ApiDocumentStatus;
}

export function DocumentStatusSelect({ id, name, status }: DocumentStatusSelectProps) {
  const [selection, setSelection] = useState({ source: status, value: status });
  if (selection.source !== status) setSelection({ source: status, value: status });

  return (
    <div className="mt-2 flex w-fit items-center gap-3 text-sm text-neutral-600">
      <span aria-hidden="true">준비 상태</span>
      <ListboxSelect
        aria-label={`${name} 준비 상태`}
        data-document-status={id}
        value={selection.value}
        options={options}
        onChange={(event) => setSelection({ source: status, value: event.target.value as ApiDocumentStatus })}
        className="inline-flex min-w-32 items-center justify-between gap-2 rounded-md border border-solid border-neutral-200 bg-white py-1.5 pl-2.5 pr-2 text-sm text-neutral-900 hover:border-neutral-300 aria-expanded:border-foundy-primary"
      />
    </div>
  );
}
