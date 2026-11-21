import type { Shop } from "@/types/market";

export interface ShopListItemProps {
  shop: Shop;
  selected: boolean;
  onSelect: (id: string) => void;
}
export function ShopListItem({ shop, selected, onSelect }: ShopListItemProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(shop.id)}
      className={`w-full rounded-xl border border-solid p-3 text-left transition-colors ${selected ? "border-foundy-primary bg-foundy-primary/5" : "border-neutral-100 bg-white hover:bg-neutral-50"}`}
    >
      <span className="flex items-start justify-between gap-2">
        <strong className="text-sm font-semibold text-neutral-800">
          {shop.name}
        </strong>
        <span className="shrink-0 text-sm font-medium tabular-nums text-foundy-primary">
          {Math.round(shop.dist).toLocaleString("ko-KR")}m
        </span>
      </span>
      <span className="mt-1 block text-sm text-neutral-600">
        {shop.cat} · {shop.sub} · 예시
      </span>
    </button>
  );
}
