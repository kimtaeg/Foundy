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
      <RangeChart title="예시 가격 범위" {...range} value={value} format={format} />
      <p className="mb-0 mt-3 rounded-xl bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700">
        {value === null
          ? "내 아메리카노 가격을 입력하면 예시 범위와 비교해요."
          : value === 0
            ? `예시 중앙값보다 ${format(range.median)} 낮아요.`
            : `예시 ${position.txt}`}
      </p>
      <p className="mb-0 mt-2 text-sm leading-relaxed text-neutral-600">최저·중앙값·최고만 있는 예시 자료예요. 가격대별 점포 수나 판매량을 뜻하지 않아요.</p>
    </div>
  );
}
