import type { MarketPoint } from "@/types/market";

export interface MarketPanelHeaderProps {
  center: MarketPoint;
  radius: number;
  onClose: () => void;
}
export function MarketPanelHeader({ center, radius, onClose }: MarketPanelHeaderProps) {
  return (
    <header className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 id="market-panel-title" className="m-0 text-xl font-semibold leading-7 tracking-tight text-neutral-900">
            상권 정보
          </h2>
          <span className="rounded-full bg-foundy-primary/8 px-2.5 py-1 text-xs font-semibold tabular-nums text-foundy-primary-ink">
            반경 {radius.toLocaleString("ko-KR")}m
          </span>
        </div>
        <p className="mb-0 mt-1.5 text-sm leading-relaxed tabular-nums text-neutral-600">
          지도 중심 · {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="상권 정보 닫기"
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-neutral-600 hover:bg-neutral-100 focus-visible:outline-foundy-primary lg:hidden"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </header>
  );
}
