import type { MarketCategory } from "@/types/market";

export interface MarketCategoryFilterProps {
  value: MarketCategory;
  onChange: (value: MarketCategory) => void;
}
const categories: readonly [MarketCategory, string][] = [
  ["all", "전체"],
  ["카페", "카페"],
  ["음식점", "음식점"],
];
export function MarketCategoryFilter({ value, onChange }: MarketCategoryFilterProps) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="점포 업종">
      {categories.map(([category, label]) => (
        <button
          key={category}
          type="button"
          aria-pressed={value === category}
          onClick={() => onChange(category)}
          className={`min-h-9 rounded-full border-0 px-3 text-sm font-medium transition-colors ${value === category ? "bg-foundy-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
