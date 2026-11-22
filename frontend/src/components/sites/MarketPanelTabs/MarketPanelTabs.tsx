import type { MarketPanelTab } from "@/types/market";

export interface MarketPanelTabsProps {
  value: MarketPanelTab;
  onChange: (value: MarketPanelTab) => void;
}
const tabs: readonly [MarketPanelTab, string][] = [
  ["summary", "요약"],
  ["population", "생활인구"],
  ["shops", "주변 점포"],
  ["planning", "가격·현장"],
];
export function MarketPanelTabs({ value, onChange }: MarketPanelTabsProps) {
  return (
    <nav
      className="grid grid-cols-4 border-0 border-b border-solid border-neutral-200"
      aria-label="상권 정보 보기"
    >
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          aria-pressed={value === tab}
          onClick={() => onChange(tab)}
          className={`min-h-11 min-w-0 cursor-pointer whitespace-nowrap border-0 border-b-2 border-solid bg-transparent px-0.5 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foundy-primary motion-reduce:transition-none ${value === tab ? "border-foundy-primary font-semibold text-neutral-900" : "border-transparent text-neutral-600 hover:text-neutral-900"}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
