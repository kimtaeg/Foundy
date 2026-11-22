import { GrantFilterTabs } from "@/components/grants/GrantFilterTabs";
import type { ReactNode } from "react";
import type { GrantFilters } from "@/types/grants";

export interface GrantFiltersBarProps {
  filters: GrantFilters;
  categories: string[];
  children?: ReactNode;
}

export function GrantFiltersBar({ filters, categories, children }: GrantFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <GrantFilterTabs filter="cat" selected={filters.cat}
        options={categories.map((category) => [category, category === "all" ? "모든 분야" : category])} />
      {children}
    </div>
  );
}
