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
| 지원사업 | `GrantsViewData`, `GrantViewItem`, `GrantMonthViewData` | `src/types/grant-view.ts` |
| 마이페이지 | `ProfileViewModel` | `src/types/profile.ts` |
| 가입·가게 등록 | `OnboardingViewModel` | `src/types/onboarding.ts` |
| 챗봇 | `ChatViewData` | `src/types/chat.ts` |
| 상권 분석 | `SitesViewData` | `src/types/market.ts` |

`ProfileViewModel`과 `OnboardingViewModel`도 함수가 없는 화면 데이터 타입이다. `*Context`는 기존 로컬 계산 계층의 타입이며 API 응답 계약이 아니다. `SitesDataServices` 같은 요청 함수와 각 컴포넌트의 콜백은 데이터와 별도 props로 전달한다.

## 준비된 데이터를 바로 전달하기

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
  unread: 0,
  actions: [],
  tasks: [],
} satisfies DashboardViewData;

export function DashboardPreview() {
  return <DashboardView data={dashboard} />;
}
```

타입 단언만으로 외부 JSON이 검증되지는 않는다. 호출 계층이 응답을 런타임 검증하고, 필드 이름·날짜·표시 라벨을 위 타입에 맞게 변환한 뒤 전달해야 한다.

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
- `[]`, `0`, `false`, `null`은 로딩의 의미가 아니다. 해당 타입이 허용하는 정상 값으로 처리한다. 예를 들어 `DashboardViewData` 자체에 `null`을 전달할 수는 없지만 `unread: 0`, `tasks: []`는 유효하다.

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

아래는 마이페이지의 기존 `data-nx="mpsave"` 버튼만 연결하는 예제다. `save`는 호출자가 현재 폼 상태를 읽어 API에 저장하는 함수이며 실제 엔드포인트는 이 예제에서 정하지 않는다.

```tsx
import { MypageView } from "@/components";
import type { ProfileViewModel, ViewEventHandler } from "@/types";

export function ProfileRemote({ data, save, onSaved, onError }: {
  data: ProfileViewModel;
  save: () => Promise<ProfileViewModel>;
  onSaved: (data: ProfileViewModel) => void;
  onError: (error: unknown) => void;
}) {
  const onEvent: ViewEventHandler = (type, event) => {
    if (type === "submit") event.preventDefault();
    if (type !== "click" || !(event.target instanceof Element)) return;
    if (!event.target.closest('[data-nx="mpsave"]')) return;
    event.preventDefault();
    void save().then(onSaved).catch(onError);
  };
  return <MypageView data={data} onEvent={onEvent} />;
}
```

이 래퍼는 Client Component 파일에서 사용한다. `onSaved`에서 부모 데이터를 갱신하고, 입력·필터 변경 등 다른 액션도 해당 화면의 이벤트 속성에 맞춰 연결한다. 현재 리팩토링은 프론트엔드의 데이터·로딩·이벤트 경계를 제공하며 DB 변경이나 새 백엔드 엔드포인트를 추가하지 않는다.
