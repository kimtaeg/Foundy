"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MarketCategoryFilter } from "@/components/sites/MarketCategoryFilter";
import { MarketPanelHeader } from "@/components/sites/MarketPanelHeader";
import { MarketPanelTabs } from "@/components/sites/MarketPanelTabs";
import type {
  MarketCategory,
  MarketPanelTab,
  MarketPoint,
} from "@/types/market";

export interface MarketAnalysisPanelProps {
  open: boolean;
  onClose: () => void;
  center: MarketPoint;
  radius: number;
  category: MarketCategory;
  onCategoryChange: (category: MarketCategory) => void;
  summary: ReactNode;
  population: ReactNode;
  shops: ReactNode;
  planning: ReactNode;
}
export function MarketAnalysisPanel({
  open,
  onClose,
  center,
  radius,
  category,
  onCategoryChange,
  summary,
  population,
  shops,
  planning,
}: MarketAnalysisPanelProps) {
  const [tab, setTab] = useState<MarketPanelTab>("summary");
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open && window.matchMedia("(max-width: 1023px)").matches)
      panel.current?.focus();
  }, [open]);
  return (
    <aside
      data-testid="market-panel"
      id="market-analysis-panel"
      ref={panel}
      tabIndex={-1}
      aria-labelledby="market-panel-title"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          onClose();
        }
      }}
      className={`${open ? "flex" : "hidden"} absolute bottom-20 right-3 top-16 z-30 w-[calc(100%-24px)] max-w-[400px] min-h-0 flex-col overflow-hidden rounded-2xl border border-solid border-neutral-200 bg-white shadow-lg outline-none sm:right-4 sm:w-[360px] lg:top-4 lg:flex lg:w-[400px]`}
    >
      <div className="shrink-0 space-y-4 border-0 border-b border-solid border-neutral-100 p-4">
        <MarketPanelHeader center={center} radius={radius} onClose={onClose} />
        {tab !== "population" && <MarketCategoryFilter value={category} onChange={onCategoryChange} />}
        <MarketPanelTabs value={tab} onChange={setTab} />
      </div>
      <div key={tab} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-neutral-50 p-3">
        {tab === "summary" && summary}
        {tab === "population" && population}
        {tab === "shops" && shops}
        {tab === "planning" && planning}
      </div>
    </aside>
  );
}
