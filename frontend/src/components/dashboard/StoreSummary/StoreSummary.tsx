import { Element } from "@/components/view/Element";
import { type DashboardStore } from "@/types/dashboard";

export type StoreSummaryProps = {
  store: DashboardStore;
  name: string;
  days: number;
  undecided: boolean;
};

export function StoreSummary({
  store,
  name,
  days,
  undecided,
}: StoreSummaryProps) {
  return (
    <Element className="nx-banner">
      <div>
        <Element className="nx-kicker">
          MY STORE · {store.type} · {undecided ? "입지 미정" : "자리 확정"}
        </Element>
        <h2 className="my-[7px]">
          {name}{" "}
          <Element as="span" className="nx-badge">
            {days >= 0 ? `D-${days}` : `개업일 경과 ${Math.abs(days)}일`}
          </Element>
        </h2>
        <Element className="nx-muted">
          {undecided
            ? `${store.region} · 후보 상권 비교 중`
            : `${store.address} ${store.detail}`}{" "}
          · 개업 예정 {store.opening}
        </Element>
      </div>
      <Element className="nx-row">
        {undecided ? (
          <Element as="button" className="nx-btn" data-nx="go" data-p="sites">
            상권 분석 보기
          </Element>
        ) : (
          <>
            <Element
              as="button"
              className="nx-btn"
              data-nx="go"
              data-p="report"
            >
              점검 리포트
            </Element>
            <Element
              as="button"
              className="nx-btn outline"
              data-nx="go"
              data-p="sites"
            >
              상권 분석
            </Element>
          </>
        )}
        <Element
          as="button"
          className="nx-btn outline"
          data-nx="askchat"
          data-q="오늘 뭐부터 하죠?"
        >
          AI에게 오늘 할 일 묻기
        </Element>
      </Element>
    </Element>
  );
}
