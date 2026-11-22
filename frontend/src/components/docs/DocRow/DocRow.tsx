"use client";

import { useId, useState } from "react";
import { DocumentStatusSelect } from "@/components/docs/DocumentStatusSelect";
import { DocSiteLinks } from "@/components/docs/DocSiteLinks";
import type { DocumentViewData } from "@/types/documents";

export interface DocRowProps {
  document: DocumentViewData;
  compact?: boolean;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
}

export function DocRow({ document, compact = false, expanded, onExpandedChange }: DocRowProps) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = expanded ?? localOpen;
  const panelId = useId();
  const { name, agency, guide, sites } = document;
  const titleClass = `break-keep text-[15px] leading-6 font-medium text-black [overflow-wrap:anywhere] ${compact ? "py-1" : "py-2.5"}`;
  if (!document.status && !agency && !guide && !sites.length) {
    return <h4 className={`${titleClass} m-0 max-w-full`}>{name}</h4>;
  }

  function toggle() {
    if (expanded === undefined) setLocalOpen(!open);
    onExpandedChange?.(!open);
  }

  return (
    <>
      <h4 className="m-0 min-w-0 max-w-full">
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle}
          className={`${titleClass} group flex max-w-full cursor-pointer items-center gap-1.5 rounded-sm border-0 bg-transparent px-0 text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary`}>
          <span>{name}</span>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform duration-200 ease-out group-aria-expanded:rotate-180 motion-reduce:transition-none">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h4>
      <div id={panelId} aria-hidden={!open} inert={!open}
        className="disclosure-panel order-last min-w-0 basis-full">
        <div className="pb-3 text-[15px] leading-relaxed">
          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
            <dt className="text-sm text-neutral-600">서류명</dt>
            <dd className="m-0 font-medium text-neutral-900 [overflow-wrap:anywhere]">{name}</dd>
            {agency && (
              <>
                <dt className="text-sm text-neutral-600">발급처</dt>
                <dd className="m-0 font-medium text-neutral-900 [overflow-wrap:anywhere]">{agency}</dd>
              </>
            )}
          </dl>
          {guide && <p className="mb-0 mt-2 max-w-prose break-keep text-[15px] leading-relaxed text-neutral-700 [overflow-wrap:anywhere]">{guide}</p>}
          {document.status && <DocumentStatusSelect id={document.id} name={name} status={document.status} />}
          <DocSiteLinks sites={sites} />
        </div>
      </div>
    </>
  );
}
