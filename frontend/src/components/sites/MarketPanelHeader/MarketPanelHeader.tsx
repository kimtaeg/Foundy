import type { MarketPoint } from "@/types/market";

export interface MarketPanelHeaderProps {
  center: MarketPoint;
  radius: number;
  onClose: () => void;
}
export function MarketPanelHeader({ center, radius, onClose }: MarketPanelHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2
            id="market-panel-title"
            className="m-0 text-lg font-bold tracking-tight text-neutral-900"
          >
            상권 정보
          </h2>
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-600">
            분석 리포트
          </span>
        </div>
        <p className="mb-0 mt-1 text-sm text-neutral-600">
          선택한 지도 중심 · 반경 {radius.toLocaleString("ko-KR")}m
        </p>
        <p className="mb-0 mt-0.5 text-sm tabular-nums text-neutral-600">
          {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="상권 정보 닫기"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-neutral-100 text-xl leading-none text-neutral-600 hover:bg-neutral-200 lg:hidden"
      >
        ×
      </button>
    </header>
  );
}
