import type { ApiDocumentStatus } from "@/lib/api/types";

const labels = {
  not_started: "준비 전",
  in_progress: "준비 중",
  obtained: "발급·취득 완료",
  submitted: "제출 완료",
  needs_fix: "보완 필요",
  not_applicable: "해당 없음",
} satisfies Record<ApiDocumentStatus, string>;

export interface DocumentStatusSelectProps {
  id: string;
  name: string;
  status: ApiDocumentStatus;
}

export function DocumentStatusSelect({ id, name, status }: DocumentStatusSelectProps) {
  return (
    <label className="mt-2 flex w-fit items-center gap-3 text-sm text-neutral-600">
      준비 상태
      <select aria-label={`${name} 준비 상태`} data-document-status={id} value={status} onChange={() => {}}
        className="rounded-md border border-solid border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900">
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}
