import { MarketEmptyState } from "@/components/sites/MarketEmptyState";
import { MarketPanelCard } from "@/components/sites/MarketPanelCard";
import { SelectedShop } from "@/components/sites/SelectedShop";
import { ShopListItem } from "@/components/sites/ShopListItem";
import type { MarketAnalysis, Shop } from "@/types/market";

export interface NearbyShopsCardProps {
  analysis: MarketAnalysis;
  shops: Shop[];
  selectedShop?: Shop;
  onSelect: (id: string) => void;
}
export function NearbyShopsCard({ analysis, shops, selectedShop, onSelect }: NearbyShopsCardProps) {
  const example = Boolean(analysis.example);
  return (
    <MarketPanelCard
      title={`${example ? "주변 예시 점포" : "주변 점포"} ${shops.length}곳`}
      description={
        example
          ? "지도 중심에서 가까운 순서예요. 점포를 누르면 지도에서도 선택됩니다."
          : "카카오 지도의 카페·음식점 검색 결과를 지도 중심에서 가까운 순서로 보여 줘요. 점포를 누르면 지도에서도 선택됩니다."
      }
    >
      {shops.length ? (
        <div className="space-y-2">
          <SelectedShop shop={selectedShop} />
          {shops.map((shop) => (
            <ShopListItem
              key={shop.id}
              shop={shop}
              selected={shop.id === selectedShop?.id}
              onSelect={onSelect}
            />
          ))}
          {analysis.truncated && (
            <p className="m-0 text-sm leading-relaxed text-neutral-600">
              카카오가 한 번에 주는 양(카페·음식점 각 45곳)까지만 가까운 순으로 보여 줘요. 반경 안에 더 많은 점포가 있을 수 있어요.
            </p>
          )}
        </div>
      ) : (
        <MarketEmptyState example={example} status={analysis.status} />
      )}
    </MarketPanelCard>
  );
}
