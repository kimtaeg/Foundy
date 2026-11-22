# 대시보드 전용 인사 헤더

대시보드는 공용 `PageHeader` 대신 `DashboardHeader`를 사용한다. 기존 `StoreSummary` 카드와
스타일 선택 UI는 제거했고, 환영형 제목·개업 일정·가게 정보·기존 액션을 하나의 페이지 헤더로 합쳤다.
다른 페이지는 공용 `PageHeader`를 그대로 사용한다.

```tsx
import { DashboardHeader } from "@/components";
import type { DashboardViewData } from "@/types";

export function Header({ data }: { data: DashboardViewData }) {
  return (
    <DashboardHeader
      store={data.store}
      name={data.name}
      days={data.days}
      undecided={data.undecided}
    />
  );
}
```

API에서 전달한 `days`를 그대로 사용한다. 양수는 개업 전, 0은 개업 당일, 음수는 개업 후다.
101이면 `D-101 / 개업까지 101일 남았어요.`, -101이면 `D+101 / 개업한 지 101일이 되었어요.`이다.
날짜를 제목 안에서 다시 계산하지 않으며, 잘못된 숫자는 일정 미정으로 처리한다.
페이지 데이터 로딩은 기존 `DataBoundary`와 헤더의 스켈레톤이 담당한다.

`DashboardGreeting`은 페이지의 유일한 h1을 표시하며 환영 인사 → 개업 안내 → 다음 행동 안내를 반복한다.
`DashboardHeaderActions`, `DashboardHeaderDetails`, `OpeningCountdown`은
각각 액션·가게 정보·D-day만 담당한다. 기존 `data-nx` 액션은 호출 페이지의 이벤트 경계로 전달한다.

재사용 가능한 `TypewriterText`는 `texts`, `paused`, `typingMs`, `deletingMs`, `holdMs`,
`className`, `cursorClassName`, `accessibleText`를 받는다. 첫 문장은 완성된 상태로 표시하고,
잠시 유지한 뒤 지우기와 다음 문장 입력을 반복한다. 한글·이모지 묶음을 유지하고 모든 문장의
높이를 미리 확보한다. 일시정지, 비활성 탭, 동작 줄이기 설정에서는 타이머를 멈춘다.
스크린리더에는 `accessibleText`를 정적인 문장으로 전달한다.

참고: [21st Typewriter](https://21st.dev/@motiondotdev/components/motion-typewriter),
[Motion 공개 예제 소개](https://motion.dev/examples/react-typewriter).
공개된 타이핑·커서 동작을 참고해 React와 Tailwind로 직접 구현했으며 별도 애니메이션 의존성은 추가하지 않았다.

검증: `npm run test:dashboard:greeting`.
