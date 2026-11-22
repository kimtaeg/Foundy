import type { Shop } from "@/types/market";

export interface SelectedShopProps { shop?: Shop }

export function SelectedShop({ shop }: SelectedShopProps) {
  if (!shop) return null;
  return (
    <div className="mb-4 rounded-r-lg border-0 border-l-[3px] border-solid border-foundy-primary bg-foundy-primary/5 px-4 py-3">
      <p className="mb-1 mt-0 text-sm font-semibold text-foundy-primary-ink">
        선택한 점포
      </p>
      <p className="m-0 text-base font-semibold text-neutral-900">{shop.name}</p>
      <p className="mb-0 mt-1 text-sm text-neutral-600">
        중심에서 {Math.round(shop.dist).toLocaleString("ko-KR")}m · {shop.sub}
      </p>
    </div>
  );
}
