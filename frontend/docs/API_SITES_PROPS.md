# 상권 분석 API props 연결

`SitesPage`는 현재 데모 store와 정적 JSON을 연결하는 컨테이너입니다. API를 연결할 때는 `SitesView`에 응답과 상태를 전달합니다. `SitesView`, 하위 카드, 지도는 `FoundyProvider` 없이 사용할 수 있습니다. 현재 DB/API를 변경하거나 새 데이터를 추가하지 않았습니다.

## 페이지 응답과 미리 계산한 분석 응답

```tsx
"use client";

import { SitesView } from "@/components/sites";
import type { SitesViewData, SitesAnalysisSelection } from "@/types/market";
import type { FootTrafficDataset } from "@/types/foot-traffic";
import type { PopulationInsights } from "@/types/population-insights";
import type { DataState } from "@/types/data-state";

type ApiSitesProps = {
  page: DataState<SitesViewData>;
  mapData?: FootTrafficDataset;
  mapLoading: boolean;
  mapError?: string | null;
  insights: DataState<PopulationInsights | null>;
  appKey: string;
  onSelectionChange: (selection: SitesAnalysisSelection) => void;
  onMapRetry: () => void;
};

export function ApiSites(props: ApiSitesProps) {
  return (
    <SitesView
      {...props.page}
      appKey={props.appKey}
      footTrafficData={props.mapData}
      footTrafficLoading={props.mapLoading}
      footTrafficError={props.mapError}
      onFootTrafficRetry={props.onMapRetry}
      populationInsights={props.insights}
      onAnalysisChange={props.onSelectionChange}
    />
  );
}
```

- 위 예제의 선택·재시도 콜백은 클라이언트 연결 계층에서 제공합니다. 일반 서버 함수를 Client Component의 콜백 props로 전달하지 않습니다.
- `page.data`는 `SitesViewData` 또는 외부에서 만든 안정적인 `Promise<SitesViewData>`입니다. Promise는 렌더 안에서 만들지 않습니다.
- `populationInsights.data`는 계산 완료된 `PopulationInsights`, 같은 타입의 안정적인 Promise, 또는 분석 자료가 없다는 뜻의 `null`입니다. 이 prop을 사용하면 프론트의 인구 원자료 loader를 호출하지 않습니다.
- `footTrafficData`는 API가 반환한 지도 JSON입니다. `footTrafficLoading`은 지도 배경과 컨트롤을 유지하면서 합계/기준일을 스켈레톤으로 바꿉니다. 오류 메시지와 재조회 동작도 부모가 전달할 수 있습니다.
- `onAnalysisChange`는 첫 렌더와 중심 좌표·반경·점포 업종·시간 변경 때 호출합니다. 부모에서 이 조건에 맞는 분석을 가져와 다시 props로 전달합니다. 오래된 요청 결과가 새 선택을 덮지 않도록 취소하거나 요청 ID로 구분해야 합니다.
- 가격 입력과 리포트 이동은 `onPriceChange`, `onOpenReport`로 연결합니다. 가격 변경 콜백을 생략하면 입력은 읽기 전용입니다.

`SitesViewData`는 주소, 점포 배열, 초기 지도 중심, 가격 입력값/비교 범위/가격 위치를 담은 JSON 타입입니다. `initialCenter`는 첫 위치입니다. 재조회한 응답이 도착해도 사용자가 선택한 지도 위치를 초기화하지 않습니다.

## 원자료 JSON을 전달하는 경우

프론트에서 기존 집계를 수행하려면 `populationInsights` 대신 `populationData: PopulationDataset`를 전달합니다. 지도에는 `footTrafficData: FootTrafficDataset`를 전달합니다.

| 데이터 | 구조와 의미 |
| --- | --- |
| `FootTrafficDataset.populations` | 파일 이름 → `PopFile` 사전. `local`, `fornLong`, `fornTemp`, `local-male`, `local-female`, `local-a00`~`local-a70` |
| `FootTrafficDataset.roads` | `RoadPiece[]`. `path`는 위경도, `mid`는 EPSG:5179 좌표의 미터 단위 중점 |
| `FootTrafficDataset.quality` | `Quality` 메타데이터 또는 확인할 수 없으면 `null` |
| `PopulationDataset` | 위 인구 파일 13개를 가진 사전. 그래프의 성별·연령별 분석에 사용 |
| `PopFile.values` | 기존 250m 격자 ID → 시간대 값 24개 |

원자료의 `0`은 공개된 0명, `"*"`는 비식별, `null`은 자료 없음입니다. `[공개 합계, 공개 행 수, 비식별 행 수]`는 일부 공개입니다. 이 의미와 기준일을 API에서 유지해야 합니다. 그래프용 `PopulationDataset`의 기준일 불일치나 누락된 필수 인구 파일은 집계 오류로 표시합니다. 지도용 `FootTrafficDataset`의 기준일 일치는 API 연결 계층에서 검증해야 합니다. 비어 있는 점포 배열은 정상 빈 상태이며 스켈레톤으로 처리하지 않습니다.

현재 점포 카드는 예시 표본이라는 문구를 유지합니다. 실제 점포 통계로 전환할 때는 데이터 출처와 전체 모집단 여부를 검증한 뒤 문구도 함께 변경해야 합니다.

## 요청 함수를 주입하는 경우

전체 원자료를 부모가 미리 가져올 필요가 없다면 다음 인터페이스를 구현해 `footTrafficSource`와 `populationSource`로 전달합니다.

```ts
interface FootTrafficDataSource {
  loadPopulation(name: string): Promise<PopFile>;
  loadQuality(): Promise<Quality | null>;
  loadRoads(center: LatLng, radius: number): Promise<RoadPiece[]>;
}

interface PopulationInsightsDataSource {
  loadDataset(): Promise<PopulationDataset>;
}
```

소스 객체는 모듈 상수 또는 `useMemo`로 안정적인 참조를 유지합니다. API 응답을 위 타입으로 매핑하는 책임은 연결 계층에 있습니다. 같은 데이터의 직접 JSON prop을 전달하면 요청 함수보다 우선합니다. 각 hook은 변경된 요청의 로딩을 즉시 반영하고 이전 요청 결과를 버립니다. 실패 후 재시도는 실제 요청을 다시 실행합니다.

## 로딩 경계

- 페이지: `SitesView`의 `DataBoundary`와 `/sites/loading.tsx`.
- 인구 요약·그래프: 실제 Promise는 Suspense, effect/외부 API 조회는 명시적 `loading`으로 스켈레톤 처리합니다.
- 지도 SDK/동적 번들: 지도 형태의 스켈레톤을 사용합니다.
- 인구·도로 요청: 지도와 설정 패널은 유지합니다. 인구 합계·기준일·그래프가 아직 도착하지 않았을 때 숫자를 0으로 채우지 않습니다.
- `data === undefined`는 미도착, `null`은 자료 없음입니다. 실패한 API는 `error`와 `onRetry`를 함께 전달합니다.

검증: `npm run test:market:data`, `npm run test:market`, `npm run test:market:loading`.
