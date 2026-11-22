"use client";

import { useId, useState } from "react";
import type { ChecklistTask } from "@/types/checklist";

export interface TaskMetadataProps {
  task: Pick<ChecklistTask, "documents" | "agency">;
}

export function TaskMetadata({ task }: TaskMetadataProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!task.documents && !task.agency) return null;

  return (
    <>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}
        className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border-0 bg-transparent px-0 py-1 text-sm font-medium text-neutral-900 before:mr-1 before:h-3 before:w-px before:bg-neutral-300 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary">
        준비 정보
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 ease-out group-aria-expanded:rotate-180 motion-reduce:transition-none">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div id={panelId} aria-hidden={!open} inert={!open} className="disclosure-panel order-last min-w-0 basis-full">
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 pt-2 text-[15px] leading-relaxed">
          {task.documents && (
            <>
              <dt className="text-sm text-neutral-600">필요 서류</dt>
              <dd className="m-0 font-medium text-neutral-900 [overflow-wrap:anywhere]">{task.documents}</dd>
            </>
          )}
          {task.agency && (
            <>
              <dt className="text-sm text-neutral-600">담당 기관</dt>
              <dd className="m-0 font-medium text-neutral-900 [overflow-wrap:anywhere]">{task.agency}</dd>
            </>
          )}
        </dl>
      </div>
    </>
  );
}
