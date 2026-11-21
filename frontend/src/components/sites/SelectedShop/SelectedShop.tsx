import type { Shop } from "@/types/market";

export interface SelectedShopProps { shop?: Shop }

export function SelectedShop({ shop }: SelectedShopProps) {
  if (!shop) return null;
  return (
    <div className="rounded-xl border border-solid border-foundy-primary/20 bg-foundy-primary/5 p-3">
      <p className="mb-1 mt-0 text-sm font-semibold text-foundy-primary-ink">
        선택한 예시 점포
      </p>
      <p className="m-0 text-sm font-semibold text-neutral-900">{shop.name}</p>
      <p className="mb-0 mt-1 text-sm text-neutral-600">
        중심에서 {Math.round(shop.dist).toLocaleString("ko-KR")}m · {shop.sub}
      </p>
      <p className="mb-0 mt-2 text-sm text-neutral-600">
        실제 영업 여부·메뉴·가격은 현장에서 확인해 주세요.
      </p>
    </div>
  );
}
