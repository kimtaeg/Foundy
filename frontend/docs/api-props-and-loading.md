# API 데이터 props와 로딩 연결

화면은 API 응답을 화면 타입으로 변환한 `data`와 이벤트 핸들러를 받는다. `DashboardView` 같은 표시 컴포넌트는 저장소를 직접 읽지 않는다. 기존 `DashboardPage`, `DocsPage`, `MypagePage`, `ConnectedChatWidget` 등의 연결 컴포넌트는 현재 데모 데이터·스토어·이벤트 처리를 유지한다. API를 연결할 때는 이 연결 계층에서 데이터와 액션을 교체한다.

전체 컴포넌트의 필드·타입·소스 경로는 [Props 목록](./component-props.md)과 [JSON 목록](./component-props.json)을 참고한다. 상권·지도 요청 함수와 선택 상태는 [상권 API props 가이드](./API_SITES_PROPS.md)에 별도로 정리한다.

## 공개 타입과 데이터 경계

```tsx
import { DashboardView, type DashboardViewProps } from "@/components";
import type { DashboardViewData, DataViewProps } from "@/types";
```

`DataViewProps<T>`는 `data?: T | Promise<T>`, `loading?: boolean`, `error?: string | null`, `onRetry?: () => void`, `onEvent?: ViewEventHandler`를 제공한다. 데이터와 동작을 분리하므로 API JSON에는 이벤트 함수나 포매터를 넣지 않는다. 날짜·라벨 등 표시 데이터도 해당 타입에 맞춰 전달한다.

| 화면 | 주요 데이터 타입 | 타입 소스 |
| --- | --- | --- |
| 대시보드 | `DashboardViewData` | `src/types/dashboard.ts` |
| 점검 리포트 | `ReportViewData` | `src/types/report.ts` |
| 체크리스트 | `ChecklistViewData` | `src/types/checklist.ts` |
| 서류 | `DocsViewData`, `DocumentTaskViewData`, `DocumentViewData` | `src/types/documents.ts` |
| 지원사업 | `GrantsViewData`, `GrantViewItem`. 공고 카드는 `grants` 배열로 표시합니다. 카드와 팝업의 포스터는 분야와 공고 ID로 생성하며 이미지 URL은 필요하지 않습니다. 선택 필드 `sourceLabel`은 공고 출처, `overview.counts`는 선택한 분야의 자격별 건수, `overview.nextDeadline`은 현재 필터에 맞는 오늘 이후(오늘 포함) 첫 마감 공고이며 없으면 `null` | `src/types/grant-view.ts` |
| 마이페이지 | `ProfileViewModel` | `src/types/profile.ts` |
| 가입·가게 등록 | `OnboardingViewModel` | `src/types/onboarding.ts` |
| 챗봇 | `ChatViewData` | `src/types/chat.ts` |
| 상권 분석 | `SitesViewData` | `src/types/market.ts` |

`ProfileViewModel`과 `OnboardingViewModel`도 함수가 없는 화면 데이터 타입이다. `*Context`는 기존 로컬 계산 계층의 타입이며 API 응답 계약이 아니다. `SitesDataServices` 같은 요청 함수와 각 컴포넌트의 콜백은 데이터와 별도 props로 전달한다.

## 체크리스트 화면 데이터 검증

2026-11-21 기준으로 `/checklist`는 `useChecklist`가 데모 스토어에서 읽은 값을 표시한다. Chrome에서 로그인 후 체크리스트 조회, 준비 정보 펼치기, 완료 체크, 달력 월 이동과 날짜 선택을 실행했을 때 fetch/XHR 요청은 0건이었다. 저장소에 체크리스트 HTTP 요청 코드나 운영 API 주소가 없어 실제 응답의 필드와 값은 미검증 상태다.

| 화면 항목 | 현재 프런트 출처 | 제공받은 DB 설계와의 대응 |
|---|---|---|
| 항목명, 분류, 단계, 기한, 완료 | 기본 할 일 9개와 선택지별 추가 규칙. 현재 가게 조건으로 목록을 구성하고 완료 변경을 브라우저에 저장 | `checklist_items`의 `item_key`, `task`, `category`, `group_label`, `due_date`, `done`. API 식별자로 명시된 `item_id`를 화면의 `task.id`에 연결 |
| 개업일과 고용 항목 | 데모 가게 정보. 개업일 변경 시 기준일과 오프셋으로 기한 재계산 | `stores.opening_date`, `stores.has_employees`, `checklist_items.offset_days` |
| 담당 기관, 연락처 | 할 일의 기관명과 로컬 기관명 매칭. 구청 번호는 예시로 표시 | `agency`와 `contact_key`에 대응. 전화번호는 설계상 백엔드 규칙에서 보강 |
| 준비할 서류, 서류 안내 개수 | 준비물은 할 일의 문구, 개수는 `documentsOf(task.id)`의 안내 건수. 건축물대장 항목은 준비물 2종에 서류함 안내 1건 | `rule_key`로 규칙 파일에서 서류 정보를 보강하는 설계. 현재 자료로는 규칙의 실제 반환 목록과 frontend 목록의 일치 여부를 확인할 수 없음 |
| 완료율, D-day, 달력과 내보내기 | 현재 할 일 목록, 기한, 개업일로 화면에서 계산. 달력에는 예시 지원사업 마감도 포함 | 완료·전체 수는 해당 가게의 전체 항목에서 집계. 지원사업 마감은 설계의 `grant_matches.title/deadline/result`에 대응하며 실제 공고 공급 여부는 별도 확인 필요 |

대조 근거는 [제공받은 스키마 사본](./market-integration/DB-schema-current.md), [체크리스트 화면 데이터 조립](../src/hooks/useChecklist.ts), [기본 할 일](../src/lib/checklist/tasks.ts), [서류 안내](../src/data/documents.ts), [기관 연락처](../src/data/contacts.ts)다. 서버 연결 검증에는 동일 가게의 조회 응답과 완료·개업일 수정 후 재조회 결과가 필요하다.

## 준비된 데이터를 바로 전달하기

`NavbarData.destinations`는 기존 `{ id, label }` 배열을 그대로 받는다. 선택적으로 `group: "preparation"`을 지정한 항목은 ‘개업 준비’ 드롭다운으로 묶이고, `description`은 항목 아래 설명으로 표시된다. 그룹을 지정하지 않은 항목은 상단에 직접 표시된다. 기본 메뉴는 홈·개업 준비·상권 분석·지원사업이며, 마이페이지는 오른쪽 가게 이름 버튼으로 접근한다. 경로와 `onNavigate` 콜백의 id는 변경하지 않는다.

```tsx
import { DashboardView } from "@/components";
import type { DashboardViewData } from "@/types";

const dashboard = {
  store: {
    name: "샘플 가게", type: "카페", address: "", detail: "",
    opening: "2026-12-01", region: "서울", location: "decided",
  },
  name: "샘플 가게",
  undecided: false,
  days: 0,
  decisions: [],
  taskCount: { done: 0, total: 0 },
  actions: [],
  tasks: [],
} satisfies DashboardViewData;

export function DashboardPreview() {
  return <DashboardView data={dashboard} />;
}
```

타입 단언만으로 외부 JSON이 검증되지는 않는다. 호출 계층이 응답을 런타임 검증하고, 필드 이름·날짜·표시 라벨을 위 타입에 맞게 변환한 뒤 전달해야 한다.

### 대시보드 bento 데이터

`DashboardViewData`의 선택 필드 `stages`는 전체 체크리스트의 단계별 `{ label, done, total }` 집계다. 일부만 내려오는 `tasks`로 전체 진행률을 추정하지 않는다. `reportCounts`는 선택 사항을 반영한 현재 판정의 개수이며, `reportSourceLabel`과 `sourceLabel`로 출처를 전달한다. `asOf`는 기한 안내에 사용할 `YYYY-MM-DD` 날짜다. 이 필드를 생략한 기존 응답도 렌더된다.

완료율 그래프의 공통 분모는 `taskCount.total`이다. 원형 그래프는 단계별 `done / taskCount.total`을 이어서 쌓고, 가로 막대도 같은 분모를 사용한다. 예를 들어 전체 11개에서 단계별 완료가 1·2·2개이면 총 5/11을 채운다. 단계의 `total`은 집계 검증에 사용하며, 단계마다 다른 분모로 표시하지 않는다.

최상단 개업 일정 카드는 `store.opening`과 `days`를 사용한다. `OpeningWeekCalendar`에는 `opening: "YYYY-MM-DD"`만 전달하면 개업일이 속한 일요일~토요일의 날짜와 개업일 표시를 구성한다. 날짜가 없거나 유효하지 않으면 가상의 주간을 표시하지 않는다. 월·연도 경계와 윤년은 UTC 기반 날짜 계산으로 처리한다.

`schedule`과 `unread`는 기존 응답 호환을 위한 선택적 deprecated 필드이며 대시보드에서 표시하지 않는다. 기존 월별 막대 그래프는 주간 날짜 장식으로 대체했고, 알림은 상단 내비게이션에서 제공한다.

생활인구는 별도 `population?: DataState<DashboardPopulationSnapshot>` prop을 받는다. 예를 들어 `<DashboardView data={dashboard} population={{ data: populationPromise }} />`로 전달하면 생활인구 카드만 독립적으로 기다리고 준비 현황은 먼저 표시한다. `loading`, `error`, `onRetry`도 지원하며, prop 자체가 없으면 데이터 연결 안내를 보여준다.

현재 `DashboardPage`는 로컬 준비 상태와 모의 점검을 사용한다. 생활인구는 기존 공개자료를 집계한 1.3KB 스냅샷이며 **성수역 기준·반경 300m·자료 기준일**을 명시한다. 가게 좌표 기반 분석이나 실시간 방문자 수가 아니다. 원본을 갱신했다면 `npm run data:dashboard`로 재생성하고 `npm run test:dashboard:data`로 집계 일치를 확인한다. 새 자료 수집이나 DB 변경은 없다.

## Promise와 명시적 로딩

서버에서 시작한 요청의 Promise를 Client View에 전달하면 `DataBoundary` 내부의 `React.use`와 `Suspense`가 기다리는 동안 스켈레톤을 표시한다. 다음은 실제 API 클라이언트 함수를 주입받는 **Server Component 래퍼** 예제다.

```tsx
import { DashboardView } from "@/components";
import type { DashboardViewData } from "@/types";

export function DashboardServer({
  loadDashboard,
}: {
  loadDashboard: () => Promise<DashboardViewData>;
}) {
  const data = loadDashboard();
  return <DashboardView data={data} />;
}
```

이 함수는 서버에서 사용하며 `loadDashboard` 자체를 Client Component에 넘기지 않는다. 클라이언트에서는 렌더마다 `fetch()`나 `Promise.resolve()`를 호출해 새 Promise를 만들지 않는다. 서버에서 전달받은 Promise, 요청 캐시 또는 상태에 보관한 Promise를 사용한다.

```tsx
"use client";

import { useState } from "react";
import { DashboardView } from "@/components";
import type { DashboardViewData } from "@/types";

export function DashboardRemote({
  initialData,
  reload,
}: {
  initialData: Promise<DashboardViewData>;
  reload: () => Promise<DashboardViewData>;
}) {
  const [data, setData] = useState(initialData);
  return (
    <DashboardView
      data={data}
      onRetry={() => setData(reload())}
    />
  );
}
```

`reload`는 클라이언트 연결 계층에서 제공하는 API 함수다. 실패한 Promise는 다시 기다려도 실패하므로 재시도 시 새 요청 Promise를 전달한다. 일반적인 서버 함수는 Client Component 콜백으로 직렬화해서 넘길 수 없다.

이미 effect나 데이터 라이브러리에서 요청 상태를 관리한다면 `data`, `loading`, `error`, `onRetry`를 그대로 전달한다. 현재 처리 순서는 `loading === true` → 오류 문자열 → `data === undefined` → 데이터 표시다. 따라서 오류 화면으로 전환할 때는 `loading`도 `false`로 바꾼다.

- `data`가 없거나 `loading`이 참이면 스켈레톤을 표시한다.
- `error` 문자열 또는 Promise 거부는 오류 UI로 처리하며 `onRetry`가 있으면 재시도할 수 있다.
- `[]`, `0`, `false`, `null`은 로딩의 의미가 아니다. 해당 타입이 허용하는 정상 값으로 처리한다. 예를 들어 `DashboardViewData` 자체에 `null`을 전달할 수는 없지만 `taskCount: { done: 0, total: 0 }`, `tasks: []`는 유효하다.

## 카드 하나씩 독립적으로 요청하기

페이지 전체 데이터는 각 View의 `DataBoundary`가 처리한다. 카드별 API를 따로 요청한다면 `ComponentBoundary`에 카드와 해당 카드의 props를 전달한다.

```tsx
"use client";

import {
  ComponentBoundary, MetricCard, SectionSkeleton,
  type MetricCardProps,
} from "@/components";

// MetricCard의 ReactNode 중 API JSON으로 전달할 수 있는 값만 사용한다.
type MetricApiData = Omit<MetricCardProps, "value"> & { value: number };

export function RemoteMetric({ data }: { data: Promise<MetricApiData> }) {
  return (
    <ComponentBoundary<MetricCardProps>
      component={MetricCard}
      data={data}
      fallback={<SectionSkeleton variant="card" label="준비 현황" />}
    />
  );
}
```

이 예제는 Client Component 파일에서 사용한다. `component={MetricCard}`는 클라이언트 래퍼 내부에서 선택하며, Server Component에서 일반 컴포넌트 함수를 props로 전달하지 않는다. 서버는 위 `RemoteMetric`에 데이터 Promise만 전달할 수 있다.

`ComponentBoundary`는 준비된 props 객체도 받으며 `loading`, `error`, `onRetry`도 지원한다. Promise는 이 예제의 호출자가 소유한다. 서로 다른 카드에 서로 다른 Promise를 넘기면 각 카드가 독립적으로 로딩된다.

이미 준비된 동기 데이터는 `Suspense`로 감싸도 스켈레톤이 나타나지 않는다. 실제 대기 중인 Promise 또는 명시적 `loading`이 있어야 한다. 버튼·아이콘·고정 제목처럼 자체 요청이 없는 하위 요소는 소유 카드·섹션의 fallback 범위에 포함하며, 인위적인 지연을 넣지 않는다. 경로 이동 중 로딩은 각 경로의 `loading.tsx`가 담당한다.

## 이벤트를 API 동작으로 연결하기

`onEvent`는 현재 마크업의 `click | input | change | submit`을 위임받는 계약이다. 데이터를 넘기는 것만으로 저장·조회·필터 동작이 API를 호출하지는 않는다. 호출자가 입력 상태와 액션별 처리를 연결해야 한다.

마이페이지에서 연필(`mpedit`)을 누르면 부모가 선택한 항목을 `data.edit`에 넣는다. 해당 행의 저장 버튼이나 Enter는 `submit` 이벤트를 발생시킨다. 다음 예제는 이 이벤트에서 항목과 새 값을 읽어 저장하는 부분이다. 취소(`mpcancel`) 또는 저장 성공 시 부모가 `edit`을 비우면 다시 읽기 화면이 된다.

```tsx
import { MypageView } from "@/components";
import type { ProfileViewModel, ViewEventHandler } from "@/types";

export function ProfileRemote({ data, save, onSaved, onError }: {
  data: ProfileViewModel;
  save: (field: string, value: string) => Promise<ProfileViewModel>;
  onSaved: (data: ProfileViewModel) => void;
  onError: (error: unknown) => void;
}) {
  const onEvent: ViewEventHandler = (type, event) => {
    if (type !== "submit" || !(event.target instanceof HTMLFormElement)) return;
    event.preventDefault();
    const field = event.target.dataset.profileField;
    const value = new FormData(event.target).get("value");
    if (field && typeof value === "string") {
      void save(field, value).then(onSaved).catch(onError);
    }
  };
  return <MypageView data={data} onEvent={onEvent} />;
}
```

이 래퍼는 Client Component 파일에서 사용한다. `onSaved`에서 부모 데이터를 갱신하고, 입력·필터 변경 등 다른 액션도 해당 화면의 이벤트 속성에 맞춰 연결한다. 현재 리팩토링은 프론트엔드의 데이터·로딩·이벤트 경계를 제공하며 DB 변경이나 새 백엔드 엔드포인트를 추가하지 않는다.
