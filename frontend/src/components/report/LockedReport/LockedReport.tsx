export function LockedReport() {
  return (
    <section aria-labelledby="locked-report-title" className="max-w-xl py-6 sm:py-10">
      <h2 id="locked-report-title" className="m-0 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
        자리를 정하면 시작돼요
      </h2>
      <p className="mb-5 mt-3 break-keep text-[15px] leading-relaxed text-neutral-600 sm:text-base">
        건물 용도와 위반건축물 여부를 점검하려면 주소가 필요해요. 상권 분석에서 후보 상권을 비교한 뒤 ‘여기로 정하기’를 눌러 주소를 입력하세요.
      </p>
      <button type="button" data-nx="go" data-p="sites"
        className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border-0 bg-foundy-primary px-4 text-sm font-semibold text-white hover:bg-foundy-primary-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary">
        상권 분석으로 이동
      </button>
    </section>
  );
}
