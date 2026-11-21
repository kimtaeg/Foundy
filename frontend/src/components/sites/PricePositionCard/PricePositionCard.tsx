import type { ChangeEvent } from "react";
import { MarketPanelCard } from "@/components/sites/MarketPanelCard";
import { PriceComparison } from "@/components/sites/PriceComparison";
import type { PricePosition, PriceRange } from "@/types/market";
import { won } from "@/lib/format";

export interface PricePositionCardProps {
  price: string;
  range: PriceRange;
  position: PricePosition;
  format?: (amount: number) => string;
  onPriceChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}
export function PricePositionCard({
  price,
  range,
  position,
  format = won,
  onPriceChange,
}: PricePositionCardProps) {
  return (
    <MarketPanelCard
      title="아메리카노 가격 비교"
      description="보유한 예시 가격 범위와 내 가격을 비교해요. 지역별 실제 시세는 아닙니다."
    >
      <label className="grid gap-2 text-sm font-medium text-neutral-700">
        내 아메리카노 가격 (원)
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="100"
          value={price}
          data-price="1"
          onChange={onPriceChange}
          readOnly={!onPriceChange}
          placeholder="예: 4500"
          className="min-h-11 w-full rounded-xl border border-solid border-neutral-200 bg-neutral-50 px-3 text-base text-neutral-900 outline-none focus:border-foundy-primary focus:bg-white"
        />
      </label>
      <PriceComparison range={range} position={position} price={price} format={format} />
      <p className="mb-0 mt-3 text-sm leading-relaxed text-neutral-600">
        실제 가격은 주변 점포의 메뉴판에서 확인하고, 원가·임대료·인건비를 함께
        고려하세요.
      </p>
    </MarketPanelCard>
  );
}
