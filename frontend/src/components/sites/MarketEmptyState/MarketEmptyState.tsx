import type { NearbyShopsStatus } from "@/types/market";

const MESSAGES: Record<NearbyShopsStatus, [string, string]> = {
  idle: ["가게 위치를 확인하고 있어요", "위치를 찾으면 반경 안의 카페·음식점을 카카오 지도에서 불러와요."],
  loading: ["주변 점포를 불러오고 있어요", "카카오 지도에서 반경 안의 카페·음식점을 찾고 있어요."],
  error: ["주변 점포를 불러오지 못했어요", "카카오 지도 장소 검색에 실패했어요. 잠시 후 다시 열어 주세요."],
  unavailable: ["주변 점포를 불러올 수 없어요", "지도 키가 설정되지 않아 카카오 지도 장소 검색을 쓸 수 없어요."],
  ready: ["선택한 조건에 표시할 점포가 없어요", "지도 중심을 옮기거나 반경과 업종을 바꿔 보세요."],
};

export interface MarketEmptyStateProps {
  status?: NearbyShopsStatus;
}

export function MarketEmptyState({ status = "ready" }: MarketEmptyStateProps) {
  const [title, body] = MESSAGES[status];
  return (
    <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600" role="status">
      <p className="mb-1 mt-0 font-semibold text-neutral-800">{title}</p>
      <p className="m-0">{body}</p>
    </div>
  );
}
