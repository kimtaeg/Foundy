# Foundy

Next.js App Router · TypeScript · Tailwind CSS 기반 창업 준비 앱입니다. 페이지와 모달은 네이티브 React 컴포넌트로 구성합니다. 원본 `foundy_toss_v5.html`은 비교 자료이며 실행 경로에서 불러오지 않습니다.

## 실행

```sh
npm install
cp .env.example .env.local
# .env.local의 NEXT_PUBLIC_KAKAO_APP_KEY에 Kakao JavaScript 키 설정
npm run dev -- --port 3000
```

`.env.local`의 `NEXT_PUBLIC_API_BASE_URL`에 FastAPI 원점을 지정합니다. 로컬 기본값은 `http://127.0.0.1:8000`이며 프론트는 `http://localhost:3000`을 사용합니다. 배포할 때는 빌드 전에 공개 API 원점을 설정하고, 백엔드의 `FRONTEND_ORIGIN`에 프론트 원점을 등록하세요. 이 Mac의 격리 개발 백엔드는 `~/.local/share/foundy-api-dev/start`로 실행할 수 있습니다.

서버와 프론트를 실행한 뒤 `npm run test:api-integration`으로 Chrome에서 신규 계정 생성부터 로그인·등록·분석·저장·로그아웃을 검사합니다. 테스트는 로컬 모의 분석 서버와 테스트용 DB에서 실행하세요.

프로덕션 빌드와 실행

```sh
npm run build
npm start -- --port 3000
```

## 디렉토리 구조

```text
src/
├── app/                         # Next.js 경로와 루트 레이아웃
├── components/
│   ├── common/                  # 반복되는 제목, 지표, 연락처, 진행 상태
│   ├── ui/                      # Input, Select, Textarea
│   ├── navigation/              # Navbar → Logo / NavLinks / AccountActions
│   ├── layout/                  # 화면 틀과 내비게이션·모달 연결
│   ├── feedback/                # Modal, Toast
│   ├── view/                    # 공통 스타일 적용과 이벤트 전달 경계
│   ├── report/                  # 페이지 조합과 카드·섹션 컴포넌트
│   │   ├── ReportView.tsx
│   │   ├── ReportCard/
│   │   │   ├── ReportCard.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── dashboard/               # 나머지 페이지도 같은 구성
│   └── index.ts
├── hooks/                       # React 상태 연결과 화면용 데이터, UI 동작
├── types/                       # 공유 타입과 상태·화면 데이터 계약
├── lib/                         # 계산, 명령 처리, 브라우저·저장소 유틸리티
│   ├── actions/                 # 사용자 행동 처리
│   ├── store/                   # 앱 상태 생성과 비동기 작업 수명 관리
│   ├── storage/                 # 계정별 localStorage 저장
│   └── styles/                  # Tailwind 스타일 recipe
├── data/                        # 시연 데이터와 상수
└── providers/                   # React Context 제공
```

페이지 컴포넌트는 훅으로 필요한 데이터를 받아 카드와 섹션을 조합합니다. 각 카드도 제목·내용·목록·액션을 역할에 맞는 하위 컴포넌트로 구성하며, 파일 하나에 공개 컴포넌트 하나를 둡니다. 로직은 `hooks`와 `lib`, 공유 타입은 `types`, 상수와 시연 데이터는 `data`에 둡니다.

기본 UI·공통 컴포넌트·내비게이션은 앱 전역 상태를 직접 읽지 않습니다. 데이터는 props로 받고, 행동은 callback 또는 `EventBoundary`에 전달하는 `data-nx` 명령으로 표현합니다. `EventBoundary`는 페이지 수준에서 명령을 상태 처리 함수에 연결합니다. 명령을 사용하는 카드는 이 경계 안에 배치해야 합니다. 계산·저장소 코드는 React 화면을 import하지 않습니다.

## 공개 import

앱 외부 조합에는 루트 또는 그룹의 `index.ts`를 사용합니다. 컴포넌트 내부에서는 해당 하위 컴포넌트의 `index.ts`를 사용하고 루트 barrel로 역참조하지 않습니다.

```tsx
import { Navbar, Logo, NavItem, MetricCard } from "@/components";
import { DashboardView } from "@/components/dashboard";
import { ReportView, GrantDetails } from "@/components";
import { FoundyProvider } from "@/providers";
import { useReport } from "@/hooks";
import type { Store, Contact, ChecklistTask } from "@/types";
```

연락처·체크리스트·알림 등 공유 데이터는 단일 타입 정의를 사용합니다. 대시보드·가입 폼의 데이터 부분집합은 원본 타입에서 `Pick`/`Omit`으로 파생합니다. 특정 컴포넌트에서만 쓰는 props는 해당 파일에 둡니다.

## 화면과 상태

공통 스타일은 Tailwind utility와 `lib/styles/recipes.ts`의 정적 recipe로 관리합니다. `Element`는 recipe를 적용하는 스타일 기본 요소이며 HTML 파싱을 하지 않습니다. `globals.css`에는 폰트·토큰·기본 reset·접근성·애니메이션만 남깁니다.

Primary는 `rgb(16, 126, 125)`, 페이지 배경은 white, 카드와 navbar는 neutral-50입니다. 텍스트와 보조 영역은 neutral 계열이며 위험·주의 표시는 의미를 구분하는 색상을 사용합니다.

API 원점이 설정되면 아이디 로그인, 가게 등록·분석, 홈, 리포트, 체크리스트, 서류함, 마이페이지, 알림이 FastAPI와 PostgreSQL을 사용합니다. 아이디와 비밀번호를 모두 `demo`로 입력하면 서버가 새 미리보기 가게를 만듭니다. 서버 분석은 `run_id`로 추적합니다. 로컬 검증 환경은 `USE_MOCK=true`로 외부 분석 자료를 대체합니다.

지원사업은 서버가 K-Startup 실제 공고를 판정한 결과(`/grants`)를, AI 상담은 서버 상담 API(`/api/chat/sessions`, SSE)를 사용합니다. 상권 분석은 저장된 가게 주소·좌표, Kakao Maps(지도·주변 점포 조회)와 포함된 공개 생활인구 스냅샷을 사용합니다. API 원점을 비워 실행하면 기존 브라우저 데모 모드를 사용할 수 있습니다.

## 상권 분석 지도

`/sites`는 내비게이션 아래 화면 전체를 지도에 사용합니다. 왼쪽의 생활인구 설정·범례와 오른쪽의 상권 정보 패널을 독립 컴포넌트로 구성했습니다. 모바일에서는 각각 버튼으로 열고 닫습니다. 지도는 가게 좌표(없으면 가게 주소, 그것도 못 찾으면 서울시청)에서 시작합니다. 지도 중심·반경을 바꾸면 공개 생활인구와 **카카오 카테고리 검색(카페 CE7·음식점 FD6)으로 불러온 실제 주변 점포** 집계가 같은 위치를 기준으로 갱신됩니다. 예시 점포로 채우지 않으며, 조회 중·위치 선택 필요·조회 불가(지도 키 없음)·실패(다시 조회)는 패널에 상태로 안내합니다. 가격 비교는 공개 가격 데이터가 없어 제외했습니다.

- `components/foot-traffic/`: 지도, 도로 레이어, 점포 마커, 설정, 범례, 로딩·오류 상태.
- `components/sites/`: 점포 구성·경쟁 표본·주변 점포·임대료 비교 패널.
- `hooks/useFootTraffic*`, `lib/foot-traffic`, `types/foot-traffic.ts`: 비동기 로딩, 위치, 좌표·통계와 데이터 계약.
- `lib/market/`: 현재 중심과 반경을 기준으로 하는 거리·표본 집계, 카카오 카테고리 검색과 장소 → 점포 변환(`kakao-shops.ts`의 `loadKakaoNearbyShops`).
- `hooks/useNearbyShops.ts`: 지도가 준비되면 중심·반경 안 카페·음식점을 가까운 순 조회(그룹당 최대 45곳, 같은 조건 12개까지 캐시, 실패 시 다시 조회).
- `public/data/foot-traffic/`: 2026-11-15 서울 생활인구와 OSM 도로 타일. 데이터 출처와 변환 규칙은 같은 디렉토리의 설명을 참고하세요.

도로 색상은 그 도로가 지나는 **250m 격자의 생활인구**이며, 도로에서 직접 센 보행량이 아닙니다. 비식별 값·행 없음·실제 0을 구분합니다. 일평균은 공개값이 있는 시간의 평균이므로 공개 시간 수와 누락·비식별 정보를 함께 확인해야 합니다. 새 기준일을 조회하는 실시간 API는 아직 연결하지 않았습니다.

Kakao JavaScript 키는 기존 지도 프로젝트의 `.env.local` 값을 사용할 수 있습니다. 실행 origin(호스트와 포트 포함)을 [Kakao Developers의 JavaScript SDK 도메인](https://apis.map.kakao.com/web/guide/)에 등록해야 합니다. REST 키·DB 비밀번호는 `NEXT_PUBLIC_` 변수에 넣지 않습니다. 키가 없거나 SDK 요청이 실패하면 지도 오류 안내가 표시되며 상권 정보 패널은 계속 사용할 수 있습니다.

## DB·API 검토 자료

상권 정보 패널의 `생활인구` 탭은 기존 13개 JSON만 가공해 24시간 공개값 흐름, 내·외국인 구성, 내국인 성별·연령별 그래프를 제공합니다. 그래프에서 선택한 시간은 지도와 공유합니다. 비율은 표시된 공개값 내 비중이며 성별·연령을 결합한 고객층, 매출·결제·요일별 추세·영업이익은 계산하지 않습니다. 점포 구성과 가격 범위는 기존 예시 자료만 시각화합니다. 새 원자료·DB 구조·차트 의존성을 추가하지 않았습니다.

`docs/market-integration/DB-API-review.md`에 최신 화면과 기존 스키마의 대응, 데이터 의미, API 계약과 남은 검토 항목을 정리했습니다. 필드 매핑 CSV와 제공받은 스키마 원문을 함께 포함합니다. `optional-market-schema.sql`은 설정 동기화·데이터 버전 관리가 필요할 때의 검토용 초안이며 실행하지 않았습니다.

`docs/market-charts/current-data-coverage.md`에는 참고 상권 보고서의 항목별 제공 가능 여부와 실제 DB 읽기 전용 확인 결과를 정리했습니다. 현재 DB의 `api_cache`에는 자료가 없으므로, 생활인구 그래프는 기존 정적 파일을 사용하며 이를 DB 조회 결과로 표시하지 않습니다.

## 검증

```sh
npm run typecheck
npm run lint
npm run test:architecture
npm run test:market:data
npm run build
FOUNDY_URL=http://localhost:3000 npm run test:functional
FOUNDY_URL=http://localhost:3000 npm run test:navigation
FOUNDY_URL=http://localhost:3000 node tests/routing-smoke.mjs
FOUNDY_URL=http://localhost:3000 npm run test:market
```

구조 검사는 컴포넌트당 공개 책임 하나, 디렉토리의 `index.ts`, 공통 UI의 전역 상태 독립성, 순환 의존성, 디렉토리 간 의존 방향을 확인합니다. 기능 검사는 리포트 선택과 완료, 체크리스트 연동, 날짜 변경·ICS, 알림, 지원사업, 지도·주변 점포, 상담, 정보 수정, 계정 전환과 가입 과정을 확인합니다.

화면 비교는 설치된 Google Chrome과 Python Pillow를 사용합니다.

```sh
FOUNDY_URL=http://localhost:3000 node tests/capture-parity.mjs migrated work/current
python3 tests/compare-parity.py work/review-before work/current
```

스크린샷과 검사 결과는 `work/`에 생성됩니다. 날짜는 고정해 비교합니다.
