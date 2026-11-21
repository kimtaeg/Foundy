import { MarketPanelCard } from "@/components/sites/MarketPanelCard";
import { StrategyRow } from "@/components/sites/StrategyRow";

export interface StrategyCardProps {
  /** 시연용 예시 점포로 분석 중이면 true */
  example?: boolean;
}

export function StrategyCard({ example = false }: StrategyCardProps) {
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
        {example ? (
          <StrategyRow
            text="주변 점포 자료는 성수역 예시입니다. 실제 경쟁과 수요 판단에는 최신 점포 조회·현장 확인이 필요해요."
            source="기존 Foundy 예시 자료"
          />
        ) : (
          <StrategyRow
            text="주변 점포는 가게 주소(또는 지도에서 고른 위치) 반경 안의 카페·음식점을 카카오 지도에서 조회한 결과예요. 실제 경쟁과 수요 판단에는 현장 확인이 필요해요."
            source="카카오 지도 장소 검색(카테고리 CE7·FD6)"
          />
        )}
      </div>
    </MarketPanelCard>
  );
}
