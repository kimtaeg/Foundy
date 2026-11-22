import { RangeChart } from "@/components/charts/RangeChart";
import type { PricePosition, PriceRange } from "@/types/market";

export interface PriceComparisonProps {
  range: PriceRange;
  position: PricePosition;
  price: string;
  format: (amount: number) => string;
}
export function PriceComparison({ range, position, price, format }: PriceComparisonProps) {
  const parsed = price.trim() === "" ? null : Number(price);
  const value = parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  return (
    <div id="priceResult" className="mt-5">
      <RangeChart title="비교 가격 범위" {...range} value={value} format={format} />
      <p className="mb-0 mt-4 rounded-r-md border-0 border-l-[3px] border-solid border-foundy-primary bg-foundy-primary/5 px-3 py-2 text-sm font-medium leading-relaxed text-neutral-800">
        {value === null
          ? "비교할 아메리카노 가격을 입력하세요."
          : value === 0
            ? `중앙값보다 ${format(range.median)} 낮아요.`
            : position.txt}
      </p>
    </div>
  );
}
