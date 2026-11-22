import { MarketEmptyState } from "@/components/sites/MarketEmptyState";
import { MarketPanelCard } from "@/components/sites/MarketPanelCard";
import { SelectedShop } from "@/components/sites/SelectedShop";
import { ShopListItem } from "@/components/sites/ShopListItem";
import type { Shop } from "@/types/market";

export interface NearbyShopsCardProps {
  shops: Shop[];
  selectedShop?: Shop;
  onSelect: (id: string) => void;
}
export function NearbyShopsCard({ shops, selectedShop, onSelect }: NearbyShopsCardProps) {
  return (
    <MarketPanelCard
      title={`주변 점포 ${shops.length}곳`}
      description="지도 중심에서 가까운 순서예요. 점포를 누르면 지도에서도 선택됩니다."
    >
      {shops.length ? (
        <div className="min-w-0">
          <SelectedShop shop={selectedShop} />
          <ul className="m-0 list-none divide-x-0 divide-y divide-solid divide-neutral-100 p-0">
            {shops.map((shop) => (
              <li key={shop.id}>
                <ShopListItem
                  shop={shop}
                  selected={shop.id === selectedShop?.id}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <MarketEmptyState />
      )}
    </MarketPanelCard>
  );
}
