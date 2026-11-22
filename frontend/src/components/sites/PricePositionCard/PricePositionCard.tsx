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
      description="입력한 가격이 비교 범위에서 어디에 있는지 확인해요."
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
          className="min-h-11 w-full rounded-lg border border-solid border-neutral-300 bg-white px-3 text-base text-neutral-900 outline-none focus:border-foundy-primary focus:bg-white"
        />
      </label>
      <PriceComparison range={range} position={position} price={price} format={format} />
    </MarketPanelCard>
  );
}
