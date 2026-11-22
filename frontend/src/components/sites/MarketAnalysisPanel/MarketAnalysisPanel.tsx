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
  /** 임대료 비교 탭 내용 (업종 칩 없이 전체 기준) */
  rent: ReactNode;
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
  rent,
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
      data-open={open}
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
      className="map-disclosure absolute bottom-20 right-3 top-16 z-30 flex w-[calc(100%-24px)] max-w-[400px] min-h-0 flex-col overflow-hidden rounded-2xl border border-solid border-neutral-200 bg-white shadow-[0_8px_28px_rgb(0_0_0/0.09)] outline-none sm:right-4 sm:w-[360px] lg:top-4 lg:w-[400px]"
    >
      <div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">
        <MarketPanelHeader center={center} radius={radius} onClose={onClose} />
        <MarketPanelTabs value={tab} onChange={setTab} />
      </div>
      <div key={tab} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-5 sm:px-5">
        {/* 업종 칩은 업종별로 달라지는 요약·주변 점포 탭에만 둔다 (생활인구·임대료 비교는 업종과 무관) */}
        {tab !== "population" && tab !== "rent" && (
          <div className="mb-5">
            <MarketCategoryFilter value={category} onChange={onCategoryChange} />
          </div>
        )}
        <div className="divide-x-0 divide-y divide-solid divide-neutral-200 [&>*]:py-6 [&>:first-child]:pt-0 [&>:last-child]:pb-0">
          {tab === "summary" && summary}
          {tab === "population" && population}
          {tab === "shops" && shops}
          {tab === "rent" && rent}
        </div>
      </div>
    </aside>
  );
}
