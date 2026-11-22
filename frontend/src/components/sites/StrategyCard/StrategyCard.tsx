import { MarketPanelCard } from "@/components/sites/MarketPanelCard";
import { StrategyRow } from "@/components/sites/StrategyRow";

export function StrategyCard() {
  return (
    <MarketPanelCard title="지도를 읽는 방법">
      <div className="space-y-3">
        <StrategyRow
          text="시간대·성별·연령대를 바꿔 생활인구 분포를 살펴보세요."
          source="서울시·KT 생활인구 공개값 기반"
        />
        <StrategyRow
          text="도로 색은 도로가 지나는 250m 격자의 생활인구 수준입니다. 실제 보행자 수나 고객 수와는 달라요."
          source="생활인구와 도로망의 공간 결합"
        />
      </div>
    </MarketPanelCard>
  );
}
