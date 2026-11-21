import { DOC_FILTERS } from "@/data/documents";
import { Element } from "@/components/view/Element";
import type { DocFilter } from "@/types/documents";

export interface DocStatusTabsProps {
  filter: DocFilter;
  counts: Record<DocFilter, number>;
  onChange(filter: DocFilter): void;
}

export function DocStatusTabs({ filter, counts, onChange }: DocStatusTabsProps) {
  return (
    <Element className="nx-seltabs" role="tablist" aria-label="서류 상태 보기">
      {DOC_FILTERS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={filter === option.value}
          className={filter === option.value ? "on" : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label} {counts[option.value]}
        </button>
      ))}
    </Element>
  );
}
