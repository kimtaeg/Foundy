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
      className="flex gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1"
      aria-label="상권 정보 보기"
    >
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          aria-pressed={value === tab}
          onClick={() => onChange(tab)}
          className={`min-h-11 shrink-0 flex-1 whitespace-nowrap rounded-lg border-0 px-3 text-sm transition-colors ${value === tab ? "bg-white font-semibold text-foundy-primary" : "bg-transparent text-neutral-600 hover:text-neutral-900"}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
