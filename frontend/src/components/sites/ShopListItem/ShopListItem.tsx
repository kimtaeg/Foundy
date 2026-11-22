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
      className={`w-full cursor-pointer rounded-md border-0 px-2 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foundy-primary ${selected ? "bg-foundy-primary/5" : "bg-transparent hover:bg-neutral-50"}`}
    >
      <span className="flex items-start justify-between gap-2">
        <strong className="text-[15px] font-semibold text-neutral-900">
          {shop.name}
        </strong>
        <span className="shrink-0 text-sm font-medium tabular-nums text-foundy-primary">
          {Math.round(shop.dist).toLocaleString("ko-KR")}m
        </span>
      </span>
      <span className="mt-1 block text-sm text-neutral-600">
        {shop.cat} · {shop.sub}
      </span>
    </button>
  );
}
