import type { NearbyShopsStatus } from "@/types/market";

export interface MarketEmptyStateProps {
  /** 시연용 예시 점포로 분석 중이면 true */
  example?: boolean;
  status?: NearbyShopsStatus;
}

export function MarketEmptyState({ example = false, status = "ready" }: MarketEmptyStateProps) {
  if (example)
    return (
      <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">
        <p className="mb-1 mt-0 font-semibold text-neutral-800">이 위치에 해당하는 예시 점포가 없어요</p>
        <p className="m-0">
          점포 자료는 성수역 주변 예시입니다. 실제 점포가 없다는 뜻은 아니며, 다른 지역의 점포·경쟁 수준은 별도 조회가 필요해요.
        </p>
      </div>
    );
  const [title, body] =
    status === "idle" || status === "loading"
      ? ["주변 점포를 불러오는 중이에요", "카카오 지도에서 이 위치 주변의 카페·음식점을 찾고 있어요."]
      : status === "error"
        ? ["주변 점포를 불러오지 못했어요", "지도 서비스 연결을 확인한 뒤 새로고침해 주세요. 지도에서 위치를 다시 골라도 다시 조회해요."]
        : ["이 반경 안에서 점포를 찾지 못했어요", "반경을 넓히거나 지도에서 다른 위치를 골라 보세요. 카카오 지도에 등록되지 않은 점포는 보이지 않을 수 있어요."];
  return (
    <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600" role="status">
      <p className="mb-1 mt-0 font-semibold text-neutral-800">{title}</p>
      <p className="m-0">{body}</p>
    </div>
  );
}
