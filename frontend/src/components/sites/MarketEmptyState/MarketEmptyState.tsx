export function MarketEmptyState() {
  return (
    <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">
      <p className="mb-1 mt-0 font-semibold text-neutral-800">
        선택한 조건에 표시할 점포가 없어요
      </p>
      <p className="m-0">
        성수역 주변으로 지도 중심을 옮기거나 반경과 업종을 바꿔 보세요.
      </p>
    </div>
  );
}
