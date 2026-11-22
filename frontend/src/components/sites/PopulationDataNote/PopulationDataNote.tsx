import { fmtYmd } from "@/lib/foot-traffic/format";

export interface PopulationDataNoteProps { date: string }

export function PopulationDataNote({ date }: PopulationDataNoteProps) {
  return (
    <details className="group text-sm leading-relaxed text-neutral-600">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 rounded-sm py-1 font-semibold text-neutral-800 focus-visible:outline-2 focus-visible:outline-foundy-primary [&::-webkit-details-marker]:hidden">
        출처와 집계 기준
        <time className="text-xs font-medium text-neutral-600" dateTime={fmtYmd(date)}>{fmtYmd(date)}</time>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="ml-auto shrink-0 duration-200 ease-out group-open:rotate-180 motion-safe:transition-transform">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="mt-3 space-y-2">
        <p className="m-0">서울특별시·KT의 기존 250m 생활인구 자료를 사용해요. 격자 중심이 선택 반경에 들어오는 공개값을 합산하며, 도로별 보행량이나 매장 방문·결제 고객 수가 아니에요.</p>
        <p className="m-0">실제 공개된 0은 숫자로 표시하고, 비식별과 미제공은 숫자 없음으로 표시해요. 일부 공개값은 전체보다 작을 수 있어요.</p>
        <p className="m-0">평균은 격자별 공개된 시간만 계산해요. 집단마다 공개 시간 수가 달라 구성값의 합과 전체 평균 합이 다를 수 있어요. 시간별 값을 더해 일일 순방문자 수로 해석하지 않아요.</p>
        <p className="m-0">성별과 연령은 각각 내국인 자료예요. 성별×연령 교차 분석이나 결제 고객 분석은 제공하지 않아요.</p>
      </div>
    </details>
  );
}
