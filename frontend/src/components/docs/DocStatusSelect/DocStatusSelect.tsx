import { DOC_STATUS_OPTIONS } from "@/data/documents";
import { Element } from "@/components/view/Element";
import type { ManagedDocumentStatus } from "@/types/documents";

export interface DocStatusSelectProps {
  id: string;
  name: string;
  status: ManagedDocumentStatus;
}

/** 서류 상태 선택. 바꾸면 change 이벤트가 data-doc-status 로 서버에 저장된다. */
export function DocStatusSelect({ id, name, status }: DocStatusSelectProps) {
  return (
    <Element className="nx-sel">
      <select key={status} defaultValue={status} data-doc-status={id} aria-label={`${name} 상태`}>
        {DOC_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Element>
  );
}
