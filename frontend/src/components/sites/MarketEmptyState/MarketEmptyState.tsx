import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { NearbyShopsStatus } from "@/types/market";

const messages = {
  ready: ["선택한 조건에 표시할 점포가 없어요", "지도 중심을 옮기거나 반경과 업종을 바꿔 보세요."],
  location: ["분석 위치를 선택해 주세요", "지도를 눌러 주변 점포를 확인할 위치를 지정해 주세요."],
  unavailable: ["주변 점포를 조회할 수 없어요", "지도를 불러온 뒤 주변 점포를 확인할 수 있어요."],
  error: ["주변 점포를 불러오지 못했어요", "잠시 뒤 다시 조회해 주세요."],
};

export interface MarketEmptyStateProps {
  status?: NearbyShopsStatus;
  onRetry?: () => void;
}

export function MarketEmptyState({ status = "ready", onRetry }: MarketEmptyStateProps) {
  if (status === "loading") return <SectionSkeleton appearance="plain" variant="list" label="주변 점포" />;
  const [title, detail] = messages[status];
  return (
    <div role={status === "error" ? "alert" : "status"} className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">
      <p className="mb-1 mt-0 font-semibold text-neutral-800">{title}</p>
      <p className="m-0">{detail}</p>
      {status === "error" && onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 cursor-pointer border-0 bg-transparent p-0 font-semibold text-foundy-primary-ink">
          다시 조회
        </button>
      )}
    </div>
  );
}
