import { GrantFilterTabs } from "@/components/grants/GrantFilterTabs";
import { GrantSortSelect } from "@/components/grants/GrantSortSelect";
import { Element } from "@/components/view/Element";
import { type GrantFilters } from "@/types/grants";

export interface GrantFiltersBarProps {
  filters: GrantFilters;
  categories: string[];
}

export function GrantFiltersBar({
  filters,
  categories,
}: GrantFiltersBarProps) {
  return (
    <Element className="nx-filters">
      <GrantFilterTabs
        filter="res"
        selected={filters.res}
        options={[
          ["all", "전체"],
          ["eligible", "신청 가능성 높음"],
          ["partial", "일부 확인 필요"],
          ["unknown", "판단 불가"],
        ]}
      />
      <GrantFilterTabs
        filter="cat"
        selected={filters.cat}
        options={categories.map((category) => [
          category,
          category === "all" ? "모든 분야" : category,
        ])}
      />
      <Element className="nx-row">
        <GrantSortSelect sort={filters.sort} />
        <GrantFilterTabs
          filter="view"
          selected={filters.view}
          options={[
            ["card", "카드"],
            ["list", "리스트"],
            ["month", "마감 달력"],
          ]}
          style={{ margin: 0 }}
        />
      </Element>
    </Element>
  );
}
