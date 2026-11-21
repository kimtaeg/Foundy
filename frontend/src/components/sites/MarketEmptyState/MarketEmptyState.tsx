export function MarketEmptyState() {
  return (
    <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">
      <p className="mb-1 mt-0 font-semibold text-neutral-800">
        이 위치에 해당하는 예시 점포가 없어요
      </p>
      <p className="m-0">
        점포 자료는 성수역 주변 예시입니다. 실제 점포가 없다는 뜻은 아니며, 다른
        지역의 점포·경쟁 수준은 별도 조회가 필요해요.
      </p>
    </div>
  );
}
