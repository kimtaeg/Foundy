# API 명세서

# 청년 창업가 종합 솔루션 — API 명세서

> 프론트(React/Next.js) ↔ 백엔드(FastAPI) 사이의 약속 문서
구조·인프라·외부 API 연동은 `아키텍처_인프라.md`, DB 테이블·컬럼은 `DB 명세서.md` 참고
이 문서의 응답 형식을 바꾸면 같은 PR에서 프론트와 백엔드를 함께 수정한다
> 

### 변경 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-11-17 | 최초 작성 |
| 2026-11-21 (아이디·비밀번호 로그인) | `POST /auth/signup`(아이디·비밀번호·이름으로 가입 후 바로 로그인)·`POST /auth/login` 추가. 아이디는 영문 소문자·숫자 4~20자, 비밀번호는 8자 이상(72바이트 이하), 비밀번호는 bcrypt 해시로만 저장. 로그인 실패는 아이디 없음·비밀번호 오류 모두 같은 `401 INVALID_CREDENTIALS`, 같은 아이디로 10분에 5번 틀리면 `429 RATE_LIMITED`. 가입 시 중복 아이디는 `409 USERNAME_TAKEN`. `user`에 `username` 추가, `provider`에 `local` 추가. 소셜 로그인 엔드포인트는 그대로 두되 화면에서는 쓰지 않는다 |
| 2026-11-21 (인증·가게 등록) | 소셜 로그인 시작 `POST /auth/social/start`(state 발급·`redirect_uri` 허용 목록·`browser_hash`) 추가, `POST /auth/social`은 `{provider, code, state, browser_nonce}`로 state와 브라우저 결속 대조(실패 시 제공자 호출 전 `400`, state 유지). 로그아웃은 요청에 쓴 토큰만 폐기(옛 토큰 호환). `PATCH /me` 규칙. 가게 등록 응답에 `address_status`, `422 ADDRESS_NOT_RESOLVED`의 `reason`·`candidates`, 업종은 규칙 묶음 `business_type_inputs`. 되묻기 답변은 `null` = 미답변, 부분 저장(생략 = 유지), 분석 중 `409`·첫 분석 후 `400`. 새 에러 코드 `INVALID_STATE`·`SOCIAL_LOGIN_FAILED`·`SOCIAL_PROVIDER_UNAVAILABLE`·`SOCIAL_LOGIN_UNAVAILABLE` |
| 2026-11-21 (알림) | 알림 시점 이동 `as_of` 구현 반영: 기한 알림(미완료·기한 지남·14일 이내) 규칙, 개업 후 달력상 6개월 mock 알림, 예시 알림의 `alert_id`(`ex-`)·읽음·`created_at`·필터 규칙 |
| 2026-11-21 | 마이페이지 수정·카드 선택 구현 반영: 분석 중 `/choose`·`PATCH /stores`는 `409 RUN_IN_PROGRESS`(저장 안 함), 재분석이 필요하면 변경과 run을 한 트랜잭션으로 저장하고 `run_id` 반환. `/choose`의 재분석 여부는 이전 선택을 비우기 전 ↔ 새 선택 후 유효 값 비교로 결정. `address_detail`(층·호수)은 `building`만. 직원 여부만 바꾸면 재분석 없이 고용 항목 생성·숨김. 미리보기 응답에 `dry_run`, `/changes` 항목에 `changed`·`impacts`·`reset_items` 추가 |
| 2026-11-20 (확정) | 프로토타입 `foundy` 확정 반영: 서류함은 **받는 곳 안내만**(`documents[]`는 서류 이름·받는 곳 링크·찾는 방법·기관 전화번호, `type`·`ready`·`prepared_id` 제거, `PATCH /documents/{doc_key}` 제거, `GET /documents`는 읽기 전용), 결과 카드에서 **`prepared[]`(문의 문구·특약·서류 초안) 제거**하고 `contact`(기관 전화번호)로 대체, 체크리스트 `prepared` 제거, **상권 분석(`/map`·`/market`)과 메뉴 광고 문구(`menu_text`)는 마지막에 구현**해 현재 범위에서 제외 |
| 2026-11-20 (서류, 같은 날 확정에서 축소됨) | **필요 서류와 서류함**: 체크리스트 항목의 `documents`를 문자열 목록에서 **서류 객체**(`type`: 만들어 줌·받는 곳·내가 준비·기관에 문의, 받는 곳 링크, 기관 전화번호, 준비 여부)로 바꾸고, `GET /documents`(서류함)·`PATCH /documents/{doc_key}`(준비 완료 체크) 추가, 대시보드 `documents_progress`, 상담의 서류 질문 응답 |
| 2026-11-19 (프로토타입 반영) | **로그인·계정**(소셜 로그인, 사용자별 가게 소유), **마이페이지**(`PATCH /stores`가 영향 `impacts[]`·초기화된 카드 `reset_items[]`를 돌려줌, 변경 기록 `/changes`), **다음으로 할 일**(`next_steps[]`), 알림 유형 확장과 `as_of`(시점 이동 시연), AI 상담 응답 `kind`·`contacts[]`·통화 준비, **상권 분석**으로 재편(`/map`·`/market`, 후보 자리 `/sites` 전부 제거), 점검 카드 선택지 `set_main_site` 제거(`adds_checklist` 추가), 지원사업 보기·필터, 화면–API 매핑 갱신 |
| 2026-11-19 (실행 단계·자동 체크) | 결과 카드에 **실행 단계** `action_status`와 `POST /report/items/{id}/action` 추가, 점검 카드를 완료하면 연결된 체크리스트 항목을 자동 완료(`auto_checked`). 지원사업 항목에 `poster` 추가. 상권 분석은 **입지를 정한 사용자**의 주소 기준으로 한정(`/map`의 주변 업소는 카카오 CE7·FD6, 후보 자리 직접 입력 제거). 입지를 정하지 않은 사용자는 대상이 아니다 |
| 2026-11-18 (결과 카드) | 점검 리포트 항목을 **"결과물 + 결정 한 번"** 구조로 변경: `consequence`, `options[]`, `recommendation`, `prepared[]`, `user_action`, `chosen_option` 추가, `next_action` 제거. 선택지 적용 `POST /report/items/{id}/choose` 추가, SSE `advise` step 추가, 대시보드 `pending_decisions` 추가, 체크리스트 항목에 `prepared`(신고서류 초안) 추가, 챗봇 `choose_option` 액션 추가 |
| 2026-11-18 | 아키텍처 문서(11-18)에 맞춰 전면 갱신: 일정표·신고를 **개업 체크리스트**(`/checklist`)로 통합, 항목별 질문(`/report/items/{id}/ask`)을 **내 가게 챗봇**(`/chat`)으로 확장, **입지·상권 지도와 매물 비교**(`/map`, `/sites`) 추가, **대출 안내 삭제**(`/loans`), **지원사업 자격 판정은 AI가 데이터에 근거해 판정**(`decided_by: ai`), 자격 값을 `eligible / partial / unknown`으로 통일(`ineligible` 삭제), 깨져 있던 화면-API 매핑표 복구 |

### 범위 표기

| 표기 | 의미 |
| --- | --- |
| **[핵심]** | 예선 링크에서 실제 데이터로 동작해야 함 |
| **[시간되면]** | 핵심 완료 후 실제 데이터로 연결 |
| **[예시]** | 예시 데이터로 화면만 시연. 응답에 `is_example: true` |
| **[로드맵]** | 구현하지 않음 |
| **마지막에 구현** | 현재 범위에서 제외. 핵심·시간되면이 끝난 뒤 구현해 붙인다 (상권 분석, 메뉴 광고 문구 점검) |
| **제외** | 만들지 않음 (대출 안내) |

### 엔드포인트 한눈에 보기

| 메서드 | 경로 | 설명 | 범위 |
| --- | --- | --- | --- |
| POST | `/api/auth/social/start` | 소셜 로그인 시작: state 발급 + 제공자 인가 주소 | 핵심 |
| POST | `/api/auth/signup` | 회원가입(아이디·비밀번호·이름): 가입 후 바로 세션 토큰 | 핵심 |
| POST | `/api/auth/login` | 아이디·비밀번호 로그인 → 세션 토큰 | 핵심 |
| POST | `/api/auth/social` | 소셜 로그인(카카오·Google·네이버): 인가 코드 + state → 세션 토큰 | 핵심 |
| POST | `/api/auth/logout` | 로그아웃 (요청에 쓴 토큰만 폐기) | 핵심 |
| GET | `/api/me` | 내 계정과 내 가게(`store_id`, 없으면 `null` → 첫 설정) | 핵심 |
| PATCH | `/api/me` | 계정 이름 수정 | 핵심 |
| POST | `/api/stores` | 가게 등록(첫 설정) + 되묻기 질문. 계정당 1개 | 핵심 |
| POST | `/api/stores/{store_id}/answers` | 되묻기 답변 | 핵심 |
| GET | `/api/stores/{store_id}` | 가게 정보 | 핵심 |
| PATCH | `/api/stores/{store_id}` | 마이페이지 가게 정보 수정 (영향 분석·영향받는 카드 초기화·재반영) | 핵심 |
| GET | `/api/stores/{store_id}/changes` | 최근 변경 반영 기록 | 핵심 |
| POST | `/api/stores/{store_id}/analyze` | 분석 실행 | 핵심 |
| GET | `/api/runs/{run_id}/stream` | 진행 상황 SSE | 핵심 |
| GET | `/api/runs/{run_id}` | 실행 상태 (SSE 대체 폴링) | 핵심 |
| GET | `/api/stores/{store_id}/dashboard` | 내 가게 대시보드 (결정할 것·직접 할 일·다음 할 일) | 핵심 |
| GET | `/api/stores/{store_id}/report` | 점검 리포트 (결과 카드: 선택지·추천·기관 전화번호) | 핵심 |
| POST | `/api/stores/{store_id}/report/items/{item_id}/choose` | 리포트 항목의 선택지 적용 (추천대로 진행 등) | 핵심 |
| POST | `/api/stores/{store_id}/report/items/{item_id}/action` | 사용자가 할 일의 진행 상태 기록 (`sent`, `done`, 결과 메모) → 다음 할 일·체크리스트 자동 체크 | 핵심 |
| GET | `/api/stores/{store_id}/checklist` | 개업 체크리스트 (시기별·카테고리별, 달력은 프론트가 같은 응답으로 그림) | 핵심 |
| PATCH | `/api/stores/{store_id}/checklist/{item_id}` | 체크리스트 완료 체크 | 핵심 |
| GET | `/api/stores/{store_id}/documents` | 서류함: 체크리스트 항목별 필요 서류와 받는 곳(공식 사이트 링크·찾는 방법·기관 전화번호). 읽기 전용 | 핵심 |
| GET | `/api/stores/{store_id}/alerts` | 알림 목록 (유형 탭, 액션, `as_of` 시점 이동) | 핵심 |
| PATCH | `/api/stores/{store_id}/alerts/{alert_id}` | 알림 읽음 처리 | 핵심 |
| POST | `/api/demo` | 예시로 해보기 / 예시 계정 (이서연 씨 사례) | 핵심 |
| GET | `/api/health` | 헬스체크 | 핵심 |
| POST | `/api/stores/{store_id}/chat` | AI 상담 (근거 기반 답변, 확인 후 적용 제안, 통화 준비) | 시간되면 |
| GET | `/api/stores/{store_id}/chat/suggestions` | 상황별 추천 질문 | 시간되면 |
| GET | `/api/stores/{store_id}/grants` | 지원사업 (자격 판정, 포스터, 필터) | 시간되면 |
| GET | `/api/stores/{store_id}/map` | 상권 분석: 지도 마커·상권 요약·경쟁 강도 | 마지막에 구현 |
| GET | `/api/stores/{store_id}/market` | 상권 분석: 가격대 분포·평균 임대료 | 마지막에 구현 (예시) |
| POST | `/api/stores/{store_id}/refresh` | 다시 조회 → 바뀐 것만 알림 | 시간되면 |
| POST | `/internal/refresh` | 예약 재조회 (토큰 보호) | 로드맵 |

---

## 1. 공통 규칙

- Base URL: `{NEXT_PUBLIC_API_BASE_URL}/api`
- 형식: JSON, UTF-8. 날짜는 `YYYY-MM-DD`, 시각은 ISO 8601(+09:00)
- 인증: **로그인 필요**. 로그인 후 받은 토큰을 `Authorization: Bearer {ACCESS_TOKEN}`으로 보낸다 (`/auth/*`, `/health`, `/demo` 제외). 가게는 `store_id`(UUID)로 식별하고 **한 계정이 가게 한 개**를 가진다. 다른 계정의 `store_id`는 `403`이다. `/internal/*`만 `Authorization: Bearer {INTERNAL_TOKEN}`
- 성공 응답: 리소스 JSON을 그대로 반환
- 에러 응답:

```json
{ "error": { "code": "STORE_NOT_FOUND", "message": "가게를 찾을 수 없습니다." } }
```

| HTTP | code | 상황 |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | 필수값 누락, 날짜 형식 오류 |
| 401 | `INVALID_CREDENTIALS` | 아이디 또는 비밀번호가 틀림 (아이디 없음과 구분하지 않음) |
| 409 | `USERNAME_TAKEN` | 회원가입 때 이미 쓰는 아이디 |
| 401 | `UNAUTHORIZED` | 로그인 토큰이 없거나 만료됨 |
| 403 | `FORBIDDEN` | 다른 계정의 가게에 접근함 |
| 404 | `STORE_NOT_FOUND`, `RUN_NOT_FOUND`, `ITEM_NOT_FOUND` |  |
| 409 | `RUN_IN_PROGRESS` | 같은 가게의 분석이 이미 실행 중. 분석 중에 카드 선택(`/choose`)·가게 정보 수정(`PATCH /stores`)을 보내도 같은 오류이며, 아무것도 저장하지 않는다 |
| 409 | `STORE_EXISTS` | 이미 가게를 등록한 계정이 다시 등록함 (수정은 `PATCH`) |
| 400 | `INVALID_STATE` | 소셜 로그인 state가 발급한 값이 아니거나 만료·재사용됨, 제공자가 다름 |
| 401 | `SOCIAL_LOGIN_FAILED` | 제공자가 인가 코드를 거절함(잘못된·만료된·재사용한 코드) 또는 사용자 id를 받지 못함 |
| 422 | `ADDRESS_NOT_RESOLVED` | 실제 주소 조회 결과가 없거나(`reason: not_found`) 후보가 여러 개(`reason: ambiguous`, `candidates` 최대 5개) |
| 502 | `SOCIAL_PROVIDER_UNAVAILABLE` | 소셜 로그인 제공자 장애(네트워크 오류·5xx) |
| 503 | `SOCIAL_LOGIN_UNAVAILABLE` | 그 제공자의 앱 키나 `redirect_uri` 허용 목록이 서버에 설정되지 않음 |
| 429 | `RATE_LIMITED` | 외부 API 한도 초과 (가능하면 캐시·mock으로 대체하고 에러를 내지 않음) |
| 500 | `INTERNAL_ERROR` |  |

### 인증과 계정 [핵심]

**아이디·비밀번호 로그인** (화면에서 쓰는 방식). 소셜 로그인은 제공자 앱 키가 있어야 해서 키가 없는 환경에서는 쓸 수 없다. 아래 두 엔드포인트는 키 없이 동작한다.

`POST /api/auth/signup` 요청: `{ "username": "foundy01", "password": "password1", "name": "김창업" }`. 응답 `201`은 소셜 로그인과 같은 형식이다.

```json
{ "access_token": "…", "user": { "user_id": "u-01", "name": "김창업", "provider": "local", "username": "foundy01", "joined_at": "2026-11-21" }, "store_id": null }
```

`POST /api/auth/login` 요청: `{ "username": "foundy01", "password": "password1" }`. 응답 `200`은 위와 같다.

- 아이디는 영문 소문자·숫자 4~20자(대문자는 소문자로 바꿔 저장·비교), 비밀번호는 8자 이상이고 UTF-8 72바이트 이하, 이름은 1~30자. 어기면 `400 INVALID_INPUT`. 정해지지 않은 필드를 보내도 `400`.
- 이미 쓰는 아이디는 `409 USERNAME_TAKEN`.
- 로그인 실패는 아이디가 없든 비밀번호가 틀리든 **같은 `401 INVALID_CREDENTIALS`**다 (계정이 있는지 알리지 않는다). 소셜·예시 계정은 아이디가 없어 이 방식으로 들어올 수 없다.
- 같은 아이디로 10분 안에 5번 틀리면 이후 시도는 맞는 비밀번호여도 `429 RATE_LIMITED`다 (서버 메모리 기준이라 재시작하면 초기화).
- 비밀번호는 bcrypt 해시로만 저장하고 응답·로그에 남기지 않는다. 로그아웃·토큰 정책은 아래 소셜 로그인과 같다.

**소셜 로그인** (제공자 앱 키가 설정된 환경에서만)


예선 프로토타입은 **소셜 로그인 화면**(카카오·Google·네이버 버튼)으로 계정을 만든다. 실제 서비스에서는 백엔드가 소셜 로그인(OAuth)의 인가 코드를 교환해 사용자를 식별하고 **자체 세션 토큰(JWT)**을 발급하며, 사용자는 PostgreSQL `users`에 저장한다. 백엔드는 토큰의 `user_id`로 가게 소유를 확인한다. 비밀번호는 서비스가 직접 받지 않는다.

**소셜 로그인 흐름** (인가 코드 방식. 요청 형식은 각 제공자 공식 문서 기준)

1. `POST /api/auth/social/start` 요청: `{ "provider": "kakao", "browser_hash": "<64자리 소문자 hex>", "redirect_uri": "http://localhost:3000/auth/callback" }` (`redirect_uri`는 선택, `browser_hash` 필수). 응답 `200`

```json
{ "provider": "kakao", "state": "…(32바이트 무작위)", "redirect_uri": "http://localhost:3000/auth/callback",
  "authorize_url": "https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=…&redirect_uri=…&state=…", "expires_in": 600 }
```

- 서버가 **state를 발급해 `browser_hash`와 함께 저장**한다(10분, 1회용). 원본 `browser_nonce`는 받지도 저장하지도 않고, 제공자에게도 보내지 않는다. `redirect_uri`는 서버 설정 `OAUTH_REDIRECT_URIS`(허용 목록)에 **정확히 같은 값**이 있을 때만 쓰고, 없으면 `400`. 생략하면 목록의 첫 값. 각 제공자 콘솔에 등록한 콜백 주소와도 같아야 한다.
- 프론트는 `authorize_url`로 이동한다. Google은 `scope=openid profile`이 붙는다.

2. 제공자가 `redirect_uri`로 `code`와 `state`를 돌려주면, 프론트는 `POST /api/auth/social`로 보낸다.

요청: `{ "provider": "kakao", "code": "…", "state": "…", "browser_nonce": "<43자 base64url>" }`. 응답 `200`

```json
{ "access_token": "…", "user": { "user_id": "u-01", "name": "김창업", "provider": "kakao", "joined_at": "2026-11-19" }, "store_id": null }
```

- 서버는 state 행을 잠근 뒤 아래 순서로 대조한다. 실패하면 모두 `400 INVALID_STATE`이고 **제공자를 부르지 않는다.**
  1. 발급한 state인가 (없거나 이미 사용·정리됨 → 거절)
  2. **브라우저 결속**: `SHA-256(browser_nonce)`가 시작 때 저장한 `browser_hash`와 같은가. 다르면 거절하되 **state를 소비하지 않는다** (로그인을 시작한 원래 브라우저가 계속 로그인할 수 있게).
  3. 결속이 확인되면 state를 **한 번 소비**(삭제·커밋)한 뒤, 제공자가 같은지·만료되지 않았는지 확인한다. 같은 state로 콜백이 동시에 여러 건 와도 잠금 때문에 한 건만 인가 코드 교환까지 간다.
- `browser_nonce`·`browser_hash` 형식이 틀리거나 빠지면 `400 INVALID_INPUT`.
- 코드 교환에는 **시작 때 저장한 `redirect_uri`**를 쓴다 (요청 본문으로 받지 않는다).
  - 카카오: `POST kauth.kakao.com/oauth/token` (`grant_type`, `client_id`, `redirect_uri`, `code`, 클라이언트 시크릿을 쓰면 `client_secret`) → `GET kapi.kakao.com/v2/user/me`의 `id`, `kakao_account.profile.nickname`
  - Google: `POST oauth2.googleapis.com/token` (`code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type`) → `GET openidconnect.googleapis.com/v1/userinfo`의 `sub`, `name`
  - 네이버(네아로 일반 방식): `POST nid.naver.com/oauth2.0/token` (`grant_type`, `client_id`, `client_secret`, `code`, `state`. `redirect_uri` 없음) → `GET openapi.naver.com/v1/nid/me`의 `response.id`, `response.nickname`(없으면 `name`)
- 같은 `(provider, 제공자 사용자 id)`로 다시 로그인하면 같은 `users` 행을 쓴다. 처음 로그인할 때만 제공자 닉네임으로 이름을 정하고(없으면 "사용자"), 이후에는 `PATCH /me`로 바꾼 이름을 유지한다.
- 제공자가 코드를 거절하면 `401 SOCIAL_LOGIN_FAILED`, 제공자 장애는 `502 SOCIAL_PROVIDER_UNAVAILABLE`, 앱 키가 없으면 `503 SOCIAL_LOGIN_UNAVAILABLE`.

**프론트 구현 규칙 (브라우저 결속)**

브라우저 결속은 **Foundy 자체 방식**으로, 로그인을 시작한 브라우저 탭에서만 콜백을 끝낼 수 있게 해 로그인 CSRF(다른 사람의 인가 코드로 로그인시키기)를 막는다. **제공자 OAuth의 PKCE(`code_challenge`/`code_verifier`)와는 별개**다. `browser_nonce`는 제공자에게 보내지 않고 Foundy API에만 쓴다. 지금 서버는 제공자 PKCE를 쓰지 않는다 (서버가 `client_secret`으로 코드를 교환하는 방식).

1. 로그인 버튼을 누를 때마다 **암호학적으로 안전한 32바이트 `browser_nonce`**를 새로 만든다: `crypto.getRandomValues(new Uint8Array(32))` → base64url(패딩 없음, 43자). `Math.random` 등은 쓰지 않는다.
2. `browser_hash = SHA-256(browser_nonce의 ASCII 바이트)`를 소문자 hex 64자로 만든다 (`crypto.subtle.digest`). `start`에는 **해시만** 보낸다.
3. 응답의 `state`를 키로 `sessionStorage`에 `{browser_nonce, provider}`를 보관한다 (예: `foundy.oauth.<state>`). `localStorage`나 쿠키에는 두지 않는다.
4. `authorize_url`로 **같은 탭에서** 이동하고, 콜백도 **같은 탭**에서 처리한다 (새 창·팝업으로 열면 `sessionStorage`가 달라 결속이 실패한다).
5. 콜백 화면에서 쿼리의 `state`로 `sessionStorage`를 찾는다. **대응하는 항목이 없으면 API를 부르지 말고 중단**하고 로그인 화면으로 돌린다. 제공자가 `error`를 돌려준 경우도 중단한다.
6. 항목이 있으면 `{provider, code, state, browser_nonce}`를 `POST /api/auth/social` **요청 본문으로만** 보낸다. 원본 nonce는 URL·쿼리·헤더·로그에 넣지 않는다.
7. 응답을 받으면(성공·실패 모두) 그 `state`의 `sessionStorage` 항목을 지운다.

**로그아웃 토큰 정책**: `POST /api/auth/logout`(Bearer) → `204`. **요청에 쓴 토큰만** 폐기 목록(`revoked_tokens`)에 올려 이후 요청을 `401`로 막는다. 같은 계정의 다른 토큰과 다시 로그인해 받은 새 토큰은 그대로 쓸 수 있다.
- 토큰은 HS256 JWT(7일)이고 새 토큰에는 `jti`가 있다. `jti`가 없는 옛 토큰(이 변경 전 발급한 예시 계정 토큰 등)은 만료될 때까지 쓸 수 있고, 로그아웃하면 토큰 문자열의 SHA-256으로 폐기한다.
- 폐기 기록과 소셜 로그인 state는 만료 후 서버 시작·로그인 시작·로그아웃 때 정리한다.

`PATCH /api/me` 요청: `{ "name": "김사장" }` → `GET /me`와 같은 응답. 앞뒤 공백을 지우고 1~30자. 다른 필드는 `400`. 가게 이름·점검 결과에는 영향이 없다.

- `store_id`가 `null`이면 프론트는 **첫 설정**(가게 등록)으로 보내고, 값이 있으면 내 가게 홈으로 보낸다.
- `GET /api/me`는 같은 `user`와 `store_id`를 돌려준다. `PATCH /api/me`는 `{ "name": "…" }`만 받고 점검 결과에는 영향이 없다.
- 계정마다 가게·점검 결과·체크리스트·알림·상담 기록이 따로 저장된다. 계정을 바꾸면 완전히 다른 가게가 나온다.
- 시연용 **예시 계정**(이서연)은 `POST /api/demo`로 들어간다 (13장).

## 2. 공통 객체

### Evidence (근거) — 모든 판단 항목에 1개 이상 필수

```json
{
  "type": "data | law | notice",
  "source": "건축물대장 층별개요",
  "value": "1층 제2종근린생활시설(일반음식점) 48.2㎡",
  "law_name": "식품위생법 시행령",
  "article": "제21조",
  "text": "조문 원문 또는 공고문 문장 일부",
  "url": "https://www.law.go.kr/...",
  "fetched_at": "2026-11-20T14:03:00+09:00",
  "from_cache": false,
  "from_mock": false
}
```

- `type`: `data`(조회 데이터 원값), `law`(조문), `notice`(공고문 문장)
- 근거가 없는 AI 판정은 서버가 `unknown`으로 내린다 (아키텍처 1-2 공통 원칙).
- 근거가 없는 규칙·일반 안내 항목도 `unknown`이다. 표시 의무 안내(`labeling`, `r-05`) 역시 예외로 `ok`를 반환하지 않는다.
- 캐시·모의 응답을 쓴 근거는 `from_cache` / `from_mock`을 `true`로 표시하고 화면에 드러낸다.

### Verdict (점검 리포트 판정)

| 값 | 화면 표시 | 의미 |
| --- | --- | --- |
| `high` | 위반 소지 높음 | 데이터로 문제가 **확인된** 경우만. 건물 용도·위반건축물은 AI 판정이 근거 검증과 규칙표 대조를 통과했을 때, 그 밖의 AI 판정은 `high`가 될 수 없다 |
| `low` | 위반 소지 낮음·확인 권장 | AI 판단이거나 데이터가 일부만 있음 (AI 판정의 상한) |
| `unknown` | 판단 불가 | 근거를 찾지 못함 → 관할 기관 확인 안내 |
| `ok` | 문제 없음 | 통과 (항목은 숨기지 않고 접어서 표시) |

- `decided_by`: `rule`(규칙 묶음) | `ai`(AI 판정). `decided_by: ai`인 항목은 `high`가 될 수 없다. **예외: 건물 용도·위반건축물**은 AI가 대장 값과 조문을 읽고 판정하며, 인용한 용도·조문 문장이 코드 검증을 통과하고 규칙표와 일치할 때만 `high`다. AI가 실패해 규칙표 카드로 대체되면 `decided_by: rule`, `ai_fallback: true`다.

### 결과 카드 객체 (점검 리포트 항목의 추가 필드)

리포트 항목은 판정만 보여주지 않고 **"결과물 + 결정 한 번"** 형태로 내려간다. 에이전트가 조사·비교·작성까지 하고, 사용자 몫은 결정·서명·방문으로 줄인다.

| 필드 | 설명 |
| --- | --- |
| `title` | 결론 한 줄. 법 용어 대신 결과 중심의 쉬운 말 ("이 자리에서는 술을 팔 수 없어요") |
| `reason` | 이유를 한두 문장으로 |
| `consequence` | 안 하면 생기는 일 (돈·시간 기준) |
| `options[]` | 선택지. 각 선택지는 아래 Option 참고. 만들 수 없으면 빈 배열 |
| `recommendation` | `{ option_id, reason }`. 추천 선택지 하나와 이유. 선택지가 없으면 `null` |
| `contact` | 이 카드와 관련된 담당 기관 연락처 (Contact). 없으면 `null`. 통화 준비의 질문 목록은 `check_id`로 규칙 묶음 `call_questions`에서 가져온다 |
| `user_action` | 사용자가 할 일 **1개**와 소요 시간 (UserAction) |
| `chosen_option` | 사용자가 고른 `option_id`. 아직이면 `null` |
| `action_status` | `user_action`의 진행 상태: `pending`(아직) \| `sent`(보냄·제출함, 결과 대기) \| `done`(완료). 기본 `pending` |
| `action_reply` | 사용자가 남긴 결과 메모. 선택이고 없으면 `null` |
| `resolved_title` | 선택지를 적용해 재분석한 뒤 판정이 바뀐 경우의 결론 한 줄. 판정이 그대로면 `null` |
| `verdict_before` | 선택 적용 전 판정. 선택 전이거나 판정이 안 바뀌면 `null` |
| `applied_changes[]` | 선택을 적용했을 때 바뀐 내용 문장 목록 (가게 정보 before→after, 체크리스트 추가·변경, 판정 변화). 선택 전이면 빈 배열 |

화면은 이 항목을 **결정 → 실행 → 완료** 3단계로 보여준다. 선택지가 없는 항목은 결정 단계가 이미 끝난 것으로 보고 실행부터 시작한다.

**Option**

```json
{
  "option_id": "o-3",
  "label": "다른 자리를 알아보기",
  "summary": "계약 전이라면 용도가 맞는 다른 자리에서 시작할 수 있어요. 새 주소를 정하면 정보 수정에서 바꿔 점검을 다시 돌려요.",
  "time": { "text": "확인 필요", "basis": null },
  "cost": { "text": "확인 필요", "delta_krw": null, "basis": null },
  "apply": { "type": "none", "adds_checklist": ["x-0"] },
  "remedy": "find_other_site"
}
```

- `remedy`: 이 선택지가 규칙 묶음의 어떤 대응 유형(`remedies`)인지. 서버가 허용된 유형만 남기는 검증에 쓰고, 화면에는 보여주지 않는다.
- `apply.type`: `update_store`(가게 정보·답변 수정) | `none`(기록만). 기준 자리를 바꾸는 유형(`set_main_site`)과 후보 자리(`site_id`)는 없다. 이 서비스는 이미 정한 자리 하나를 기준으로 한다.
- `apply.adds_checklist`: 이 선택지를 고르면 체크리스트에 추가되는 항목 id 목록. 선택을 되돌리면 다시 빠진다.
- `time`, `cost`: **근거가 있을 때만 숫자를 쓴다.** `basis`는 `rule | calc | data | notice | null`이고, `null`이면 `text`를 "확인 필요"로 내리고 `delta_krw`는 `null`로 둔다. AI가 기간·금액을 추정해서 채우지 않는다.
- 금액 차이(`delta_krw`) 같은 숫자는 계산 도구가 계산한다. 선택지의 문장과 추천 이유만 AI가 쓴다.
- 선택지의 종류는 규칙 묶음의 해당 점검 항목에 적힌 `remedies`(가능한 대응 유형) 범위 안에서만 만든다.

**Contact**

```json
{ "agency": "성동구청 건축과", "phone": "02-2286-5114", "is_example": true, "tip": null }
```

- 전화번호는 AI가 만들지 않고 규칙 묶음 `contacts`·관할 기관 데이터(관할 구청은 주소의 시군구 기준)에서만 가져온다. 관할 구청 번호는 주소의 시군구 코드로 고르고, 규칙 묶음 표에 없는 지역은 정부민원안내콜센터(110, 확인된 번호)로 대체하며 `tip`에 "관할 구청 건축과로 연결해 달라고 말씀하세요" 같은 안내를 담는다. 번호를 확인하지 못한 경우는 `phone: null`로 두고 화면에서 "확인 필요"로 표시한다. `is_example: true`이면 "예시" 배지를 붙인다. 개업 체크리스트의 `agency`와 서류의 `contact`도 같은 규칙이다.
- 문의 문구·특약 문구·신고서류 초안은 **만들지 않는다.** 웹에서는 문자 앱을 열 수 없어서 "문자 앱 열기"도 없다. 사용자는 전화번호를 복사해 직접 전화하고, 물어볼 질문은 AI 상담의 통화 준비 도우미(8장)가 알려 준다.

**UserAction**

```json
{ "type": "send", "text": "구청 건축과에 전화로 문의하기", "est_minutes": 3 }
```

- `type`: `send`(문의하기: 전화·민원 접수) | `sign`(서명·제출) | `visit`(방문) | `decide`(결정)
- 정부24 제출, 서명, 구청 방문은 자동화할 수 없는 영역이다. 서비스는 이 단계 전까지를 대신하고 `user_action`에는 사용자가 직접 해야 하는 일 하나만 적는다.
- 선택한 선택지에 따라 `user_action`이 달라질 수 있다 (선택지별 `user_action`을 둘 수 있고, 없으면 카드의 기본 `user_action`을 쓴다).

**NextStep (다음으로 할 일)**

```json
{ "kind": "new", "title": "용도가 맞는 다른 후보 자리 알아보기", "sub": "이 선택으로 새로 생긴 할 일 · 예정 01.05", "go": { "page": "checklist", "item_id": "x-0" } }
```

- `kind`: `new`(이번 선택으로 새로 생긴 할 일) | `decide`(아직 결정하지 않은 카드) | `do`(다른 카드의 직접 할 일) | `task`(가장 가까운 체크리스트). 이 순서로 정렬해 **최대 5개**를 내려준다.
- 정렬과 선택은 **코드가 한다** (AI 아님). 결정은 `verdict: high`인 카드가 먼저이고, 직접 할 일은 `action_status: pending`인 카드만, 체크리스트는 아직 완료하지 않은 항목 중 `due_date`가 빠른 2개다. `task`의 `sub`에는 담당 기관 전화번호(`contact`)를 붙일 수 있다.
- 비어 있으면 "점검 리포트의 모든 항목을 마쳤어요. 체크리스트로 이어가세요"를 보여준다.
- 같은 내용이 알림(`type: next`)으로 남는다 (12장).


### 지원사업 자격 판정 (Eligibility)

| 값 | 화면 표시 | 의미 |
| --- | --- | --- |
| `eligible` | 신청 가능성 높음 | 확인된 조건이 모두 충족 |
| `partial` | 일부 확인 필요 | 충족한 조건이 있고 확인하지 못한 조건이 남음 |
| `unknown` | 판단 불가 | 근거 부족. 공고문 원문·주관 기관 확인 안내 |

- 자격 판정은 **AI가 조회한 공고문 안에서** 하고, 조건마다 공고문 문장을 인용한다. 나이·업력 같은 숫자 조건 대조는 계산 도구가 수행해 AI가 결과를 받는다.
- 조건 한 건이라도 명확히 충족하지 못하면(`fail`) 그 공고는 목록에서 제외하고 `excluded_count`로만 알린다.

---

## 3. 가게 등록(첫 설정)과 마이페이지 [핵심]

### `POST /api/stores` — 가게 등록 (로그인 후 첫 설정)

요청

```json
{
  "name": "모노커피",
  "business_type_input": "카페",
  "address": "서울특별시 성동구 성수이로 00",
  "address_detail": "1층",
  "opening_date": "2027-03-02",
  "owner_birth_year": 1998
}
```

- `owner_birth_year`는 선택. 정책 자격 판정에만 쓴다.
- (마지막에 구현) `menu_text`(메뉴·광고 문구)는 효능 표현 점검(`ad_claims`)을 붙일 때 추가한다. 지금은 받지 않는다.
- 로그인한 계정이 가게를 아직 갖고 있지 않을 때만 호출할 수 있다 (이미 있으면 `409 STORE_EXISTS`). 가입 직후 첫 설정 화면에서 호출한다.
- 필수: `name`, `business_type_input`, `address`, `opening_date`. `business_type_input`은 규칙 묶음의 `business_type_inputs`(지금은 `카페`·`음식점`) 안의 값만 받는다 (가게 수정과 같은 검증). 이름·주소를 비우거나 형식이 틀리면 `400 INVALID_INPUT`.
- `address`는 필수다. 이 서비스는 **어디에서 사업을 할지 이미 정한 사용자**를 대상으로 하고, 이 주소를 기준으로 점검 리포트와 개업 체크리스트를 만든다. 주소를 바꾸려면 `PATCH /stores/{store_id}`를 쓴다 (`needs_reanalyze: true`).

응답 `201`

```json
{
  "store_id": "8f2c...",
  "address_status": "resolved",
  "address_resolved": {
    "road": "서울특별시 성동구 성수이로 00",
    "jibun": "서울특별시 성동구 성수동2가 000-0",
    "codes": { "sigungu_cd": "11200", "bjdong_cd": "11500", "bun": "0000", "ji": "0000" },
    "coord": { "lat": 37.54, "lng": 127.05 }
  },
  "questions": [
    { "id": "sells_alcohol", "text": "술도 판매하시나요?", "type": "boolean", "why": "술을 팔면 신고 업종이 휴게음식점에서 일반음식점으로 바뀝니다." },
    { "id": "uses_terrace", "text": "테라스나 가게 앞 공간을 쓰시나요?", "type": "boolean", "why": "옥외 영업은 별도 확인이 필요합니다." },
    { "id": "has_employees", "text": "직원을 고용하시나요?", "type": "boolean", "why": "직원이 있으면 근로계약·4대보험 일정이 생깁니다." },
    { "id": "funds_krw", "text": "준비된 자금은 얼마인가요?", "type": "number", "optional": true, "why": "지원사업 안내에 씁니다." }
  ]
}
```

- `questions`는 규칙 묶음의 후보 중 AI가 고른 것. 이미 답이 있는 것은 빠지고, 필수 질문(`sells_alcohol`)은 항상 들어간다. AI를 쓸 수 없으면 남은 후보를 모두 묻는다 (등록을 막지 않는다).
- `address_status`: `resolved`(실제 조회로 하나 확인, `address_resolved`에 코드) | `unverified`(주소 조회 키가 없거나 `USE_MOCK=true`라 조회하지 않음) | `lookup_failed`(조회 서비스 장애). `unverified`·`lookup_failed`면 `address_resolved: null`이고 주소 코드 없이 저장한다. 모의 주소 코드는 다른 주소의 값이라 저장하지 않는다. 코드가 없으면 분석 때 주소를 다시 조회한다.
- 실제 조회 결과가 없거나 후보가 여러 개면 `422 ADDRESS_NOT_RESOLVED`이고 아무것도 저장하지 않는다.

```json
{ "error": { "code": "ADDRESS_NOT_RESOLVED", "message": "주소 후보가 여러 개입니다. …", "reason": "ambiguous", "candidates": ["서울 성동구 성수동2가 289-10", "…"] } }
```

### `POST /api/stores/{store_id}/answers` — 되묻기 답변

요청

```json
{ "answers": { "sells_alcohol": true, "uses_terrace": false, "has_employees": true, "funds_krw": 40000000 } }
```

응답 `200`

```json
{
  "store_id": "8f2c...",
  "business_type": "일반음식점",
  "business_type_reason": "주류 판매 → 일반음식점 (규칙)",
  "answers": { "sells_alcohol": true, "uses_terrace": false, "has_employees": true, "funds_krw": 40000000 },
  "questions": []
}
```

- 답변 칸은 `null`이 **아직 답하지 않음**이다. **보낸 필드만** 저장한다: 생략한 필드는 그대로 두고, 명시한 `false`는 `false`로 저장한다. 예/아니요 답(`sells_alcohol`·`uses_terrace`·`has_employees`)은 `null`로 보낼 수 없고(`400`), `funds_krw`만 `null`로 지울 수 있다. 빈 `answers`는 `400`.
- 응답의 `answers`는 저장 후 전체 값이다. `questions`는 아직 답하지 않은 기본 질문(선택 질문 `funds_krw` 제외)이고, 비어 있으면 분석을 시작할 수 있다. 분석은 `sells_alcohol`이 `null`이면 `400`이다.
- 분석이 실행 중이면 `409 RUN_IN_PROGRESS`, **첫 분석을 마친 뒤**(`stores.onboarded_at`이 있음)에는 마이페이지 수정 안내와 함께 `400 INVALID_INPUT`이다.
- `business_type`은 규칙 묶음이 결정한다 (AI 아님).

### `GET /api/stores/{store_id}` — 가게 정보

```json
{
  "store_id": "8f2c...",
  "name": "모노커피",
  "business_type_input": "카페",
  "business_type": "일반음식점",
  "address": "서울특별시 성동구 성수이로 00",
  "address_detail": "1층",
  "address_codes": { "sigungu_cd": "11200", "bjdong_cd": "11500", "bun": "0000", "ji": "0000", "coord": { "lat": 37.54, "lng": 127.05 } },
  "opening_date": "2027-03-02",
  "answers": { "sells_alcohol": true, "uses_terrace": false, "has_employees": true, "funds_krw": 40000000 },
  "owner_birth_year": 1998,
  "region": "서울 성동구",
  "is_demo": false
}
```

### `PATCH /api/stores/{store_id}` — 마이페이지: 가게 정보 수정

마이페이지에서 사업 정보를 바꾸면 **영향받는 점검만 다시 반영**한다. 요청은 바꾼 필드만 보낸다.

```json
{ "address": "서울특별시 성동구 성수이로 99", "opening_date": "2027-04-01", "answers": { "sells_alcohol": false } }
```

수정할 수 있는 필드: `name`, `business_type_input`, `address`, `address_detail`, `opening_date`, `owner_birth_year`, `answers.sells_alcohol`, `answers.uses_terrace`, `answers.has_employees`, `answers.funds_krw`.

- `business_type_input`은 가게 등록과 같은 규칙(규칙 묶음 `business_type_inputs`, 지금은 `카페`·`음식점`)으로 검증한다. 지원하지 않는 업종은 미리보기(`?dry_run=true`)와 저장 모두 `400 INVALID_INPUT`이고 아무것도 저장하지 않는다. 입력 검증은 분석 중 확인(`409`)보다 먼저 한다.

응답 `200`

```json
{
  "store_id": "8f2c...",
  "changed": [ { "field": "address", "from": "…성수이로 12", "to": "…성수이로 99" } ],
  "impacts": ["building", "law", "checklist"],
  "reset_items": [ { "item_id": "r-01", "title": "건물 용도·주류", "chosen_label": "다른 자리를 알아보기" } ],
  "recomputed": ["checklist"],
  "needs_reanalyze": true,
  "run_id": "b72e..."
}
```

**영향 규칙** (코드가 정하며 AI가 판단하지 않는다)

| 바꾼 필드 | `impacts` | 다시 하는 일 |
| --- | --- | --- |
| `opening_date` | `dates` | 체크리스트 날짜만 계산 도구로 재계산 (외부 조회 없음) |
| `name` | `trademark` | 상표 검색(KIPRIS) |
| `address` | `building`, `law`, `checklist` (+ `market`은 상권 분석을 붙일 때) | 건축물대장·조문 조회, 체크리스트 재구성 |
| `address_detail` (층·호수) | `building` | 건축물대장(층별 용도) 조회만 |
| `business_type_input`, `answers.sells_alcohol` | `building`, `law`, `checklist` | 업종 구분·건물 용도·신고 항목 |
| `answers.uses_terrace` | `law`, `checklist` | 옥외영업 관련 점검 |
| `answers.has_employees` | `checklist` | 고용 카테고리 표시 여부. 재분석 없이 규칙 묶음으로 바로 갱신 (없음 → 있음이면 고용 항목 생성) |
| (마지막에 구현) `menu_text` | `ad` | 광고 문구 점검(AI) |
| `owner_birth_year` | `grants` | 지원사업 자격 판정 |
| `answers.funds_krw` | `costs` | 비용·지원사업 계산 |
| (마지막에 구현) `answers.my_americano_krw` | (없음) | 저장만 (상권 분석의 가격 포지셔닝 입력값) |

- **영향받는 점검 카드의 선택은 초기화한다.** 예를 들어 주소가 바뀌면 건물 용도 카드(`r-01`)와 위반건축물 카드(`r-03`)의 `chosen_option`·`action_status`가 지워지고 다시 결정 대기가 된다. 지워진 카드는 `reset_items[]`로 알려 주고, 프론트는 **저장 전에** 이 목록을 미리 보여 준다 (미리보기는 같은 규칙으로 프론트가 계산하거나 `?dry_run=true`로 호출한다).
- 카드가 초기화되면 그 카드로 생긴 체크리스트 항목(`adds_checklist`)과 자동 체크(`auto_checked`)도 함께 풀린다. 사용자가 직접 체크한 항목은 그대로 둔다.
- 개업일만 바뀌면 `needs_reanalyze`는 `false`이고 `recomputed: ["checklist"]`만 돌려준다 (체크리스트 날짜만 재계산, 외부 조회·AI 없음).
- 직원 여부만 바뀌면 재분석하지 않는다. 직원 없음 → 있음이면 고용 체크리스트 항목을 만들고, 있음 → 없음이면 항목을 지우지 않고 숨긴다 (체크 상태 유지).
- 재분석 범위(`runs.scope`)는 `impacts` 중 `building`·`law`·`trademark`·`checklist`이고, 외부 조회가 필요한 단계(`building`·`law`·`trademark`)가 하나라도 있을 때만 재분석한다. `dates`·`costs`·`grants`는 재분석 범위가 아니다.
- 카드를 초기화해 선택 효과(예: 술 빼기)가 사라지면 그 값의 영향 단계도 `impacts`에 더한다.
- `needs_reanalyze: true`이면 서버가 **변경 내용과 새 분석 실행을 한 트랜잭션으로 저장**하고 `run_id`를 돌려준다 (`runs.trigger = user`, 진행은 4장의 SSE). 마이페이지는 "다시 반영 중" 진행 창으로 보여 준다.
- 분석이 실행 중이면 `409 RUN_IN_PROGRESS`이고 아무것도 저장하지 않는다. 미리보기(`?dry_run=true`)는 DB를 바꾸지 않으므로 분석 중에도 된다.
- 응답의 `needs_reanalyze`는 **서버가 실제로 새 run을 만들었는지**이고 항상 `run_id`가 있을 때만 `true`다. 미리보기 응답은 저장 응답과 같은 형식이고 `dry_run: true`, `run_id: null`이며, `needs_reanalyze`는 저장하면 재분석할지(예정)를 뜻한다. 미리보기와 실제 저장은 같은 영향 계산을 쓴다.
- 바뀐 값이 없거나(같은 값 재전송) 주소·이름을 비우면 `400 INVALID_INPUT`. 주소·층을 바꾸면 저장된 `address_codes`를 비워 재분석에서 새 주소로 다시 조회한다. 새 주소의 실제 조회(또는 그 캐시)에 성공하면 분석 결과를 저장할 때 새 `address_codes`도 저장해 관할 기관 연락처(`contact`)가 새 주소 기준으로 바뀐다. 조회에 실패하거나 모의 응답으로 대체되면 비운 채로 두고(이전 코드를 되살리지 않음) 연락처는 기본 안내(110)다.
- 챗봇이 제안한 조건 변경도 사용자가 확인한 뒤 이 엔드포인트로 반영한다 (`/chat`의 `actions` 참고).
- 변경 내용은 `GET /api/stores/{store_id}/changes`에 남는다.

### `GET /api/stores/{store_id}/changes` — 최근 변경 반영 기록

```json
{ "items": [ { "change_id": "ch-01", "at": "2026-11-19",
  "changed": [ { "field": "address", "from": "…성수이로 12", "to": "…성수이로 99" } ],
  "impacts": ["building", "law", "checklist"],
  "reset_items": [ { "item_id": "r-01", "title": "건물 용도·주류", "chosen_label": "다른 자리를 알아보기" } ],
  "lines": ["주소: …성수이로 12 → …성수이로 99", "“건물 용도·주류” 카드 선택 초기화 (다시 결정 대기)"] } ] }
```

- 최근 10건. 같은 내용이 알림(`type: change`)으로도 남는다 (12장).

---

## 4. 분석 실행과 진행 스트리밍 [핵심]

### `POST /api/stores/{store_id}/analyze`

요청

```json
{ "scope": ["building", "law", "trademark", "checklist", "grants"] }
```

- `scope` 생략 시 핵심 전체(`building`, `law`, `trademark`, `checklist`). `grants`는 구현 여부에 따라 무시될 수 있다. `market`은 상권 분석을 붙일 때(마지막에 구현) 추가한다. 마이페이지 수정으로 시작한 재분석은 `impacts`에 해당하는 단계만 `scope`로 담는다.

응답 `202`

```json
{ "run_id": "a91d...", "status": "queued" }
```

### `GET /api/runs/{run_id}/stream` — SSE

`Content-Type: text/event-stream`

```
event: step
data: {"step":"address","status":"done","message":"주소 확인: 성수동2가 000-0"}

event: step
data: {"step":"building","status":"running","message":"건축물대장 조회 중"}

event: step
data: {"step":"building","status":"done","message":"1층 용도: 제2종근린생활시설","source":"건축물대장"}

event: step
data: {"step":"trademark","status":"done","message":"유사 상표 2건 발견"}

event: step
data: {"step":"law","status":"fallback","message":"법령 API 응답 지연 → 저장된 조문 사용"}

event: item
data: {"check_id":"building_use","verdict":"high","decided_by":"ai","title":"이 자리에서는 술을 팔 수 없어요","has_options":true}

event: done
data: {"run_id":"a91d...","summary":{"high":1,"low":3,"unknown":1,"ok":7},"cost_krw":0}

event: error
data: {"code":"INTERNAL_ERROR","message":"..."}
```

| step | 내용 |
| --- | --- |
| `address` | 주소 → 코드·좌표 |
| `building` | 건축물대장 |
| `trademark` | 상표 검색 |
| `law` | 조문 조회 |
| `rules` | 규칙 묶음 판정 (업종 구분, 건물 용도 규칙표 준비) |
| `interpret` | AI 판정·요약 (해당 신고·인허가, 위험) |
| `advise` | 선택지·추천 생성 (판정이 `ok`가 아닌 항목) |
| `checklist` | 개업일 역산 체크리스트 생성 (계산 도구) |
| `grants` | 지원사업 조회·AI 자격 판정 |
| `market` | (마지막에 구현) 상권 분석 데이터 (주변 동종 업소 조회) |
- `status`: `running | done | fallback | skipped | failed`. `fallback`은 캐시·mock으로 대체했다는 뜻이고 화면에 표시한다.
- 스트림이 끊기면 `GET /api/runs/{run_id}`로 상태와 `events`를 폴링한다.

### `GET /api/runs/{run_id}` — 실행 상태

```json
{ "run_id": "a91d...", "trigger": "user", "status": "done", "events": [ ... ], "started_at": "...", "finished_at": "..." }
```

- `trigger`: `user | refresh | chat | demo`

실행 조회는 `scope`(실제로 실행한 핵심 단계)와 `error`(정상 시 null, 실패 시 사용자 안내)를 함께 반환한다.
저장 이벤트는 `{event, data, at}` 형태이며 SSE의 event/data와 같은 내용이다.
결과·비용·알림 저장과 실행의 done 갱신이 성공한 뒤에만 완료 이벤트가 공개된다.

SSE는 Bearer 인증을 사용한다. Swagger의 Authorize 또는 Authorization 헤더를 전달하는 스트림 클라이언트로 호출한다.
각 이벤트에는 저장 순서에 따른 `id`가 있고, 재연결 시 `Last-Event-ID`로 마지막 수신 번호를 보내면 다음 이벤트부터 재생한다.
실행 중에는 연결 유지 주석을 보내며 done/failed 상태의 저장 이벤트를 모두 전달한 뒤 연결을 닫는다.
스트림 종료가 분석을 취소하지는 않는다. 연결이 끊어지면 인증한 폴링 요청으로 최종 상태를 조회한다.

부분 분석은 지정한 단계만 외부 조회한다. law만 실행할 때 필요한 건물 입력은 기존 조회 캐시에서 재사용하고,
캐시가 없으면 해당 건물 판정은 unknown이다. 요청하지 않은 결과와 사용자 진행 상태는 보존한다.
grants는 선택 기능으로 핵심 분석과 함께 지정하면 생략하며, grants만 지정한 요청은 현재 400이다.
단일 서버의 동시 실행 한도가 찬 요청은 503 ANALYSIS_BUSY, 같은 가게의 중복 실행은 409 RUN_IN_PROGRESS다.

---

## 5. 내 가게 대시보드 [핵심]

### `GET /api/stores/{store_id}/dashboard`

```json
{
  "store": { "store_id": "8f2c...", "name": "모노커피", "business_type": "일반음식점", "opening_date": "2027-03-02", "d_day": -102 },
  "last_run": { "run_id": "a91d...", "finished_at": "2026-11-20T14:05:00+09:00" },
  "report_summary": { "high": 1, "low": 3, "unknown": 1, "ok": 7 },
  "pending_decisions": [
    { "item_id": "r-01", "title": "이 자리에서는 술을 팔 수 없어요", "verdict": "high", "recommended_option": "다른 자리를 알아보기" }
  ],
  "today_todos": [
    { "item_id": "r-01", "task": "구청 건축과에 전화로 문의하기", "due_date": "2027-01-05", "category": "건물·시설", "est_minutes": 3 }
  ],
  "next_steps": [ { "kind": "decide", "title": "결정하기 · 상표 점검", "sub": "추천: 이름 바꾸기", "go": { "page": "report", "item_id": "r-02" } } ],
  "checklist_progress": { "done": 2, "total": 9 },
  "documents_progress": { "finished": 1, "total": 8 },
  "alerts": { "unread": 2, "latest": [ { "title": "청년 창업 지원사업 새 공고", "type": "grant", "is_example": false } ] },
  "menus": {
    "report": "ready",
    "checklist": "ready",
    "documents": "ready",
    "chat": "ready",
    "grants": "ready"
  }
}
```

- `documents_progress`: 서류함 요약. `total`은 체크리스트 항목에 필요한 서류 수, `finished`는 **완료한 체크리스트 항목의 서류 수**다 (서류를 따로 체크하지 않는다). 상권 분석을 붙이면 `menus`에 `map`·`market`이 추가된다.
- `menus` 값: `ready | not_requested | example | unavailable`. `example`은 화면에 "예시 데이터" 배지를 붙인다.
- `d_day`는 개업일까지 남은 일수를 음수로 표현한다 (개업일 당일 0).
- `pending_decisions`: 선택지가 있는데 아직 `chosen_option`이 없는 리포트 항목. 대시보드 첫 화면에서 "결정할 것"으로 보여주고 카드를 열면 `[추천대로 진행]`을 바로 누를 수 있다.
- `next_steps[]`: 가장 최근에 실행·완료한 카드 이후 이어서 할 일(NextStep). 처음에는 결정 대기 카드와 가장 가까운 체크리스트로 채운다.
- `today_todos`는 사용자가 직접 해야 하는 일(`user_action`)을 보여준다. "~를 확인하세요" 대신 "구청 건축과에 전화로 문의하기 (3분)"처럼 구체적인 행동과 소요 시간을 함께 둔다.

---

## 6. 점검 리포트 [핵심]

### `GET /api/stores/{store_id}/report`

쿼리: `stage` (선택: `계약 전`, `개업 전`, `운영 중`)

```json
{
  "store_id": "8f2c...",
  "run_id": "a91d...",
  "generated_at": "2026-11-20T14:05:00+09:00",
  "summary": { "high": 1, "low": 3, "unknown": 1, "ok": 7 },
  "groups": [
    {
      "stage": "계약 전",
      "items": [
        {
          "item_id": "r-01",
          "check_id": "building_use",
          "title": "이 자리에서는 술을 팔 수 없어요",
          "verdict": "high",
          "decided_by": "ai",
          "reason": "술을 팔려면 일반음식점으로 신고해야 하는데, 이 건물 1층은 휴게음식점(카페)까지만 가능한 제1종 근린생활시설이에요.",
          "consequence": "이대로 계약하면 영업신고가 반려돼 보증금이 묶일 수 있어요.",
          "options": [
            {
              "option_id": "o-1", "label": "술 빼고 카페로 시작", "summary": "휴게음식점으로 신고합니다. 바로 가능해요.",
              "time": { "text": "즉시", "basis": "rule" },
              "cost": { "text": "추가 비용 없음", "delta_krw": 0, "basis": "rule" },
              "apply": { "type": "update_store", "payload": { "answers": { "sells_alcohol": false } }, "needs_reanalyze": true },
            },
            {
              "option_id": "o-2", "label": "용도변경 신청", "summary": "구청 승인과 건물주 동의가 필요해요.",
              "time": { "text": "확인 필요", "basis": null },
              "cost": { "text": "확인 필요", "delta_krw": null, "basis": null },
              "apply": { "type": "none" },
            },
            {
              "option_id": "o-3", "label": "다른 자리를 알아보기", "summary": "계약 전이라면 용도가 맞는 다른 자리에서 시작할 수 있어요. 새 주소를 정하면 정보 수정에서 바꿔 점검을 다시 돌려요.",
              "time": { "text": "확인 필요", "basis": null },
              "cost": { "text": "확인 필요", "delta_krw": null, "basis": null },
              "apply": { "type": "none", "adds_checklist": ["x-0"] }
            }
          ],
          "recommendation": { "option_id": "o-3", "reason": "①은 주류 매출을 포기해야 하고, ②는 개업일(3/2) 안에 끝난다는 보장이 없어요. 계약 전이라면 용도가 맞는 자리를 다시 알아보는 쪽이 가장 안전해요." },
          "contact": { "agency": "성동구청 건축과", "phone": "02-2286-5114", "is_example": true },
          "user_action": { "type": "send", "text": "구청 건축과에 전화로 문의하기", "est_minutes": 3 },
          "evidence": [ { "type": "data", "source": "건축물대장 층별개요", "value": "1층 제1종근린생활시설", "fetched_at": "..." }, { "type": "law", "law_name": "건축법 시행령", "article": "별표 1", "url": "https://www.law.go.kr/..." } ],
          "chosen_option": null,
          "added_to_checklist": ["c-01"]
        },
        {
          "item_id": "r-02",
          "check_id": "trademark_similar",
          "title": "'모노커피'와 비슷한 상표가 이미 등록돼 있어요",
          "verdict": "low",
          "decided_by": "ai",
          "reason": "같은 서비스 분류에 발음이 비슷한 등록 상표 2건이 있어요.",
          "consequence": "간판을 달고 난 뒤 상표권자가 문제 삼으면 간판과 메뉴판을 바꿔야 할 수 있어요.",
          "options": [
            { "option_id": "o-1", "label": "이름 바꾸기", "summary": "겹치지 않는 후보: ○○, △△", "time": { "text": "즉시", "basis": "rule" }, "cost": { "text": "간판 제작 전이면 추가 비용 없음", "delta_krw": 0, "basis": "rule" }, "apply": { "type": "update_store", "payload": { "name": "○○" }, "needs_reanalyze": true } },
            { "option_id": "o-2", "label": "그대로 진행", "summary": "위험을 알고 진행합니다.", "time": { "text": "즉시", "basis": "rule" }, "cost": { "text": "확인 필요", "delta_krw": null, "basis": null }, "apply": { "type": "none", "adds_checklist": ["x-2"] } }
          ],
          "recommendation": { "option_id": "o-1", "reason": "간판을 만들기 전이라 지금 바꾸는 비용이 가장 낮아요." },
          "contact": null,
          "user_action": { "type": "decide", "text": "이름을 바꿀지 정하기", "est_minutes": 3 },
          "evidence": [ { "type": "data", "source": "KIPRIS", "value": "등록 4000000000000 '모노 커피' (제43류)", "url": "...", "fetched_at": "..." } ],
          "chosen_option": null,
          "added_to_checklist": []
        },
        {
          "item_id": "r-03",
          "check_id": "building_violation",
          "title": "위반건축물인지 확인할 수 없어요",
          "verdict": "unknown",
          "decided_by": "ai",
          "reason": "건축물대장 응답에 위반건축물 표기 정보가 없어요.",
          "consequence": "위반건축물이면 영업신고가 반려될 수 있어요.",
          "options": [],
          "recommendation": null,
          "contact": { "agency": "성동구청 건축과", "phone": "02-2286-5114", "is_example": true },
          "user_action": { "type": "send", "text": "구청 건축과에 전화로 문의하기", "est_minutes": 3 },
          "evidence": [ { "type": "data", "source": "건축물대장 표제부", "value": "위반건축물 표기 없음(필드 미제공)", "fetched_at": "..." } ],
          "chosen_option": null,
          "added_to_checklist": ["c-01"]
        }
      ]
    },
    { "stage": "개업 전", "items": [] },
    { "stage": "운영 중", "items": [] }
  ],
  "disclaimer": "법률 자문이 아닌 사전 점검입니다. 중요한 결정 전에는 관할 기관에 확인하세요."
}
```

- 항목에 대한 추가 질문("이 항목은 왜 이런가요?")은 AI 상담 `/chat`의 `focus`로 한다 (8장).
- `added_to_checklist`: 이 항목에서 파생돼 체크리스트에 추가된 `item_id` 목록 (`checklist_items.origin_item_key`).
- **결과 카드 구조**: `verdict`가 `ok`가 아닌 항목은 결론(`title`) → 이유(`reason`) → 안 하면 생기는 일(`consequence`) → 선택지(`options`) → 추천(`recommendation`) → 기관 전화번호(`contact`) → 사용자가 할 일 1개(`user_action`) 순으로 화면에 보여준다. 법 조문과 근거(`evidence`)는 "자세히 보기"로 접어 둔다. 필드 정의는 2장 "결과 카드 객체" 참고.
- `title`은 법 용어 대신 **결과 중심의 쉬운 말**로 쓴다. `verdict: ok` 항목은 `title`과 `reason`만 있으면 된다.
- 선택지를 만들 수 없으면(`options: []`) 기관 전화번호(`contact`)와 `user_action`만 내려준다. 문의 문구·특약·서류 초안은 만들지 않는다.

### `POST /api/stores/{store_id}/report/items/{item_id}/choose` — 선택지 적용

요청

```json
{ "option_id": "o-3" }
```

응답 `200`

```json
{
  "item_id": "r-01",
  "chosen_option": "o-3",
  "applied": [],
  "added_checklist": ["x-0"],
  "applied_changes": ["체크리스트에 추가: 용도가 맞는 다른 후보 자리 알아보기", "이 자리의 점검은 위반 소지 높음으로 유지돼요"],
  "recomputed": ["checklist"],
  "needs_reanalyze": false,
  "run_id": null
}
```

- 사용자가 `[추천대로 진행]` 또는 다른 선택지를 눌렀을 때 호출한다. 서버가 `apply`에 적힌 변경(가게 정보·답변 수정, 체크리스트 항목 추가)을 반영한다.
- 재분석 여부는 **이전 선택을 비우기 전과 새 선택을 적용한 후의 유효 값**(5-2, `sells_alcohol`·`name`)을 비교해 코드가 정한다. 바뀐 값의 영향 단계(3장 영향 규칙)에 `building`·`law`·`trademark`가 있으면 `needs_reanalyze: true`다. 새 선택에는 효과가 없어도 이전 선택의 효과(예: 술 빼기)가 사라지면 재분석한다. 유효 값이 그대로면(같은 선택 재전송 포함) 재분석하지 않는다.
- `needs_reanalyze: true`이면 서버가 **선택 내용과 새 분석 실행을 한 트랜잭션으로 저장**하고 `run_id`를 돌려준다 (`runs.trigger = user`). 프론트는 진행 화면으로 이동한다. 재분석하지 않으면 `run_id`는 `null`이다. 응답의 `needs_reanalyze`는 **서버가 실제로 새 run을 만들었는지**(`run_id`가 있을 때만 `true`)이고, 선택지 `options[].apply.needs_reanalyze`(AI가 붙인 안내)와 역할이 다르다. 프론트는 진행 화면 이동을 응답의 값으로 정한다.
- 분석이 실행 중이면 `409 RUN_IN_PROGRESS`이고 선택을 저장하지 않는다. 없는 선택지는 실행 여부와 상관없이 `400 INVALID_INPUT`.
- `apply.type`이 `none`인 선택지는 `chosen_option`만 기록한다.
- 이미 선택한 항목을 다시 호출하면 선택을 바꾼다 (이전 선택으로 생긴 변경은 재분석으로 다시 계산된다).
- 응답의 `applied_changes`, `verdict_before`, `resolved_title`로 화면이 "무엇이 바뀌었는지"를 바로 보여준다. 선택을 바꾸면 `action_status`는 `pending`으로 돌아간다.

### `POST /api/stores/{store_id}/report/items/{item_id}/action` — 할 일 진행 상태 기록

요청

```json
{ "status": "done", "reply": "구청에서 내일 답변 주기로 함" }
```

응답 `200`: `{ "item_id": "r-01", "action_status": "done", "action_reply": "구청에서 내일 답변 주기로 함", "auto_checked": ["c-01"], "next_steps": [ … ] }`

- `status`: `pending | sent | done`. `pending`으로 보내면 되돌린다. `reply`는 선택.
- `status`가 `done`이 되면 이 카드와 연결된 체크리스트 항목을 서버가 자동으로 완료하고 `auto_checked`에 `item_id`를 담는다. 한 체크리스트 항목에 카드가 여러 개 연결돼 있으면 **연결된 카드가 모두 `done`일 때** 자동 완료된다. 카드를 `pending`으로 되돌리거나 선택을 바꾸면 **자동으로 체크된 항목만** 되돌리고, 사용자가 직접 바꾼 체크는 유지한다.
- 응답의 `next_steps[]`는 **다음으로 할 일**(NextStep, 2장)이다. `sent`이면 "답변을 기다리는 동안 먼저 할 일", `done`이면 "이제 이 순서로 할 일"로 보여 준다. 프론트는 이 목록을 완료한 카드 안에 바로 그린다.
- 서비스는 문자 발송·정부24 제출을 대신하지 않는다. 사용자가 직접 한 뒤 상태만 기록한다.
- `sent`와 `done`은 알림(`type: next`, 12장)으로 남고, `pending`으로 되돌리면 그 알림은 사라진다. `done`이 되면 관련 결정 대기 알림은 닫는다.

---

## 7. 개업 체크리스트 [핵심]

일정표와 신고·인허가를 하나로 통합한 화면이다. 개업일 기준 역산 날짜(시기)와 카테고리 두 축으로 본다.

### `GET /api/stores/{store_id}/checklist`

쿼리: `view` (`timeline`(기본) | `category`)

```json
{
  "opening_date": "2027-03-02",
  "progress": { "done": 2, "total": 9 },
  "groups": [
    {
      "group_label": "계약 전",
      "items": [
        {
          "item_id": "c-01",
          "task": "건축물대장 확인 및 임대차 계약 검토",
          "category": "건물·시설",
          "dday": -56,
          "due_date": "2027-01-05",
          "documents": [
            { "doc_id": "bldg", "name": "건축물대장 (일반·집합)", "agency": "정부24 · 세움터", "guide": "정부24에서 “건축물대장 열람/발급”을 검색하거나, 세움터의 건축물대장 발급·열람 메뉴에서 주소로 조회해요", "links": [ { "label": "정부24", "url": "https://www.gov.kr/" }, { "label": "세움터 (건축행정시스템)", "url": "https://www.eais.go.kr/" } ] }
          ],
          "agency": "관할 구청 건축과",
          "source": "rule",
          "report_item_ids": ["r-01", "r-03"],
          "evidence": [ { "type": "data", "source": "건축물대장 표제부", "fetched_at": "..." } ],
          "done": false,
          "auto_checked": false
        },
        {
          "item_id": "g-kstartup-000000",
          "task": "청년 창업 지원사업 신청 마감",
          "category": "정책",
          "dday": -30,
          "due_date": "2027-01-31",
          "documents": [],
          "agency": "K-Startup",
          "source": "grant",
          "report_item_ids": [],
          "evidence": [ { "type": "notice", "text": "신청 기간: ~2027-01-31", "url": "..." } ],
          "done": false
        }
      ]
    },
    {
      "group_label": "개업 4주 전",
      "items": [
        {
          "item_id": "c-04",
          "task": "일반음식점 영업신고에 필요한 서류 준비",
          "category": "영업 인허가",
          "dday": -28,
          "due_date": "2027-02-02",
          "documents": [
            { "doc_id": "apply", "name": "영업신고 접수", "agency": "정부24 · 관할 구청 위생과", "guide": "정부24에서 “영업신고”를 검색해 신청하거나, 관할 구청 위생과에 직접 제출해요. 신고 업종과 필요 서류는 구청에 먼저 확인하세요", "links": [ { "label": "정부24", "url": "https://www.gov.kr/" } ], "contact": { "agency": "관할 구청 위생과", "phone": "02-2286-5114", "is_example": true } }
          ],
          "agency": "관할 구청 위생과",
          "source": "rule",
          "report_item_ids": ["r-04"],
          "evidence": [ { "type": "law", "law_name": "식품위생법", "article": "제37조", "url": "..." } ],
          "done": false
        }
      ]
    },
    { "group_label": "개업 직전", "items": [] }
  ],
  "hidden_categories": [
    { "category": "고용", "hidden_reason": "직원을 고용하지 않음" }
  ]
}
```

- `group_label`: `계약 전 | 개업 4주 전 | 개업 직전 | 개업 후`. 기본 항목은 규칙 묶음에 적힌 고정 값이다. 지원사업 마감 항목(`source: grant`)만 `dday`로 나눈다 (≤ -29 계약 전, -28~-15 개업 4주 전, -14~-1 개업 직전, 0 이상 개업 후). `view=category`이면 `groups`가 `category` 기준으로 묶이고 `group_label`은 항목 안에 남는다.
- `category`: `영업 인허가 | 세무 | 고용 | 건물·시설 | 간판·광고 | 표시 의무 | 정책`
- `source`: `rule`(규칙 묶음 기본 항목) | `report`(점검 리포트에서 파생) | `grant`(지원사업 마감)
- 날짜(`due_date`, `dday`)는 규칙 묶음의 `offset_days` 값과 개업일로 **계산 도구**가 계산한다. AI는 날짜를 직접 계산하지 않는다.
- 조건에 맞지 않는 카테고리(예: 직원 없음 → 고용)는 `hidden_categories`로 내려주고 프론트는 숨긴다.
- 점검 리포트 항목과 같은 일인 체크리스트 항목은 `report_item_ids[]`로 연결하고 `auto_checked`(자동 체크 여부)를 내려준다. 연결 관계는 규칙 묶음(`checklist`의 `report_links`)에 둔다. 예) 건물 확인·임대차 계약 검토 ↔ 건물 용도 점검 + 위반건축물 점검, 영업신고 서류 준비 ↔ 영업신고 서류 점검.
- 필요 서류·담당 기관은 규칙 묶음에 적힌 값이며 근거 링크를 함께 둔다. `documents[]`는 아래 "서류 객체"이고, 서류를 받는 곳만 안내한다 (서류별 준비 체크는 없다).
- 서류를 대신 만들어 주지 않는다 (초안·정보 시트 없음). 제출은 사용자가 직접 한다 (`user_action.type: sign`).
- 지원사업 마감일은 `source: grant`로 자동 추가된다.
- **달력 보기**는 별도 API 없이 같은 응답의 `due_date`와 개업일(`opening_date`)로 프론트가 그린다. 점은 카테고리 색, 개업일은 깃발로 표시하고 지원사업 마감(`source: grant`)도 함께 보여 준다. `.ics` 내보내기는 프론트가 응답으로 파일을 만든다.
- 카드로 인해 생긴 항목(`source: report`)은 그 카드의 선택을 되돌리면 사라진다.

### `PATCH /api/stores/{store_id}/checklist/{item_id}`

```json
{ "done": true }
```

응답 `200`: 수정된 항목

### 서류 객체 (`documents[]`)와 서류함 [핵심]

신고·신청에 필요한 서류를 항목마다 **어디서 받는지**만 안내한다. 서류를 대신 만들어 주지 않고, 서류별 준비 여부도 저장하지 않는다.

```json
{
  "doc_id": "apply",
  "name": "영업신고 접수",
  "agency": "정부24 · 관할 구청 위생과",
  "guide": "정부24에서 “영업신고”를 검색해 신청하거나, 관할 구청 위생과에 직접 제출해요. 신고 업종과 필요 서류는 구청에 먼저 확인하세요",
  "links": [ { "label": "정부24", "url": "https://www.gov.kr/" } ],
  "contact": { "agency": "관할 구청 위생과", "phone": "02-2286-5114", "is_example": true }
}
```

| 필드 | 뜻 |
| --- | --- |
| `name` | 서류 이름 (예: 건축물대장, 상표 검색 결과, 사업자등록 신청, 영업신고 접수, 옥외광고물 신고·허가 안내, 표준 근로계약서 양식, 4대보험 취득 신고, 원산지·가격 표시 안내) |
| `agency` | 받는 곳 이름 |
| `guide` | 어떤 메뉴를 눌러 찾는지 한두 문장 |
| `links[]` | 공식 사이트 **첫 화면** 주소 (정부24·홈택스·세움터·KIPRIS·고용노동부·4대사회보험 정보연계센터·국립농산물품질관리원) |
| `contact` | 영업신고·간판처럼 기관에 확인해야 하는 서류만. 전화번호는 Contact 규칙(2장) |

- **링크는 AI가 만들지 않는다.** 규칙 묶음(`documents`·`sites`)에 적힌, 사람이 확인한 공식 사이트 주소만 내려준다. 첫 화면 주소와 `guide`(어떤 메뉴를 누르는지)로 안내하고, 세부 신청 페이지 주소는 바뀌기 쉬워 쓰지 않는다. 프론트는 새 탭(`rel="noopener noreferrer"`)으로 연다.
- 서류는 가게 상태에 따라 달라진다. 항목이 숨겨지면(직원 없음 → 고용) 그 서류도 빠지고, 선택지로 생긴 항목(`source: report`, 예: `x-0`·`x-2`)의 서류는 그 카드를 되돌리면 사라진다.
- 발급 비용·소요 기간은 근거(규칙·데이터)가 있을 때만 숫자로 쓰고 없으면 "확인 필요"다.

### `GET /api/stores/{store_id}/documents` — 서류함

```json
{
  "summary": { "total": 8, "finished": 1, "remaining": 7 },
  "groups": [
    { "item_id": "c-01", "task": "건축물대장 확인 및 임대차 계약 검토", "group_label": "계약 전", "due_date": "2027-01-05", "dday": -56, "agency": "관할 구청 건축과", "done": false,
      "documents": [ { "doc_id": "bldg", "name": "건축물대장 (일반·집합)", "agency": "정부24 · 세움터", "guide": "…", "links": [ { "label": "정부24", "url": "https://www.gov.kr/" } ] } ] }
  ],
  "disclaimer": "정부 서식은 해당 사이트에서만 효력이 있어요. 링크는 공식 사이트 첫 화면이고, 찾는 방법은 각 서류 아래에 적어 뒀어요. 발급·제출은 직접 해야 해요."
}
```

- 체크리스트와 같은 데이터를 **서류가 있는 항목 기준으로 다시 묶은** 읽기 전용 화면이다 (기한순). 서류 자체를 따로 저장하지 않고 규칙 묶음의 `documents`와 체크리스트 상태로 만든다.
- `summary`: `total`은 전체 서류 수, `finished`는 **완료한 체크리스트 항목의 서류 수**, `remaining`은 나머지다.
- 서류함에는 쓰기 API가 없다 (`PATCH /documents/...` 없음). 항목을 완료하려면 체크리스트에서 체크한다.

---

## 8. AI 상담 [시간되면]

### `POST /api/stores/{store_id}/chat`

요청

```json
{
  "message": "위반건축물이면 아예 못 여는 건가요?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "focus": { "type": "report_item", "id": "r-03" }
}
```

- `history`는 프론트가 보관해 매번 보낸다 (서버는 대화 기록을 저장하지 않는다).
- `focus`는 선택. `report_item` | `checklist_item` | `grant`를 지정하면 그 항목을 **우선 근거**로 삼는다. 리포트 카드의 "이 항목 질문하기"가 이것을 쓰고, 화면은 그 카드를 대화 위에 고정해 보여 준다. 다른 주제를 물으면 고정된 카드에 갇히지 않고 그 주제로 답한다.

응답 `200`

```json
{
  "kind": "grounded",
  "answer": "건축물대장 응답에 위반건축물 표기 정보가 없어요. 위반건축물이면 영업신고가 반려될 수 있어요.",
  "evidence": [ { "type": "data", "source": "건축물대장 표제부", "value": "위반건축물 표기 없음(필드 미제공)", "fetched_at": "…" } ],
  "actions": [
    {
      "type": "update_store",
      "label": "개업일 2027-03-02 → 2027-04-01 변경",
      "summary": ["개업일 2027-03-02 → 2027-04-01", "체크리스트 날짜 재계산 (예: 건축물대장 확인 01.05 → 02.04)"],
      "payload": { "opening_date": "2027-04-01" },
      "requires_confirm": true
    }
  ],
  "contacts": [],
  "call_prep": null,
  "follow_up": ["왜 이런가요?", "안 하면 어떻게 되나요?", "전화로 문의할 땐 뭐라고 하죠?"],
  "note": "이 가게의 점검 결과 안에서만 답했어요. 최종 판단은 관할 기관에 확인하세요."
}
```

**`kind`**

| 값 | 뜻 | 화면 |
| --- | --- | --- |
| `grounded` | 이 가게의 저장된 근거 안에서 답함 | "근거 기반" 배지 + 근거 칩 |
| `change` | 조건 변경·선택지 적용·체크 처리를 **제안** | "변경 제안" 배지 + 전/후 미리보기 + `[확인하고 적용]` |
| `oos` | 근거 밖(세금·4대보험·대출 등) → 판단 불가 | "판단 불가" 배지 + 문의할 기관 전화번호(`contacts[]`) |
| `chitchat` | 인사·안내 | 배지 없음 |

**규칙**

- 답변은 **이 가게에 저장된 근거 안에서만** 한다. 사실을 묻는 질문인데 인용할 근거(`evidence`)가 없으면 서버가 `kind`를 `oos`로 바꾸고 관할 기관을 안내한다. 근거는 AI가 쓰지 않고, AI가 고른 항목 id를 코드가 그 항목의 근거로 채운다.
- 근거 칩(`evidence[]`)을 누르면 리포트의 "판정 근거 자세히"와 같은 창이 열린다.
- **바꾸는 일은 제안만 한다.** `actions[]`는 `requires_confirm: true`이고 `summary[]`에 변경 전후를 담는다. 사용자가 확인하면 프론트가 아래 API를 호출한다. 확인하기 전에는 아무것도 바뀌지 않는다.
  - `update_store`: `PATCH /stores/{store_id}` (개업일 변경은 `recomputed: ["checklist"]`, 그 밖은 `needs_reanalyze`)
  - `choose_option`: `payload`는 `{ "item_id": "r-01", "option_id": "o-3" }`, `POST /report/items/{item_id}/choose`
  - `check_item`: `payload`는 `{ "item_id": "c-03" }`, `PATCH /checklist/{item_id}`
  - `navigate`: 화면 이동(확인 불필요). `payload`는 `{ "page": "report", "item_id": "r-01" }`
- `contacts[]`: 문의할 기관 연락처 목록 `{ agency, phone, tip, is_example }`. 전화번호는 AI가 만들지 않고 규칙 묶음·기관 데이터에서만 가져온다 (2장 Contact와 같은 규칙).
- `call_prep`: **통화 준비 도우미**. "구청에 전화하기 전에 뭘 준비하죠?"처럼 물으면 돌려준다.

```json
{ "item_id": "r-03", "contact": { "agency": "성동구청 건축과", "phone": "02-2286-5114", "is_example": true },
  "steps": ["안녕하세요, 카페 창업을 준비 중인 예비 창업자입니다. 건축과 담당자를 연결해 주실 수 있을까요?", "…"],
  "questions": ["이 건물(해당 층)이 위반건축물로 등재돼 있나요?", "…"] }
```

  통화 후 결과는 `POST /report/items/{item_id}/action`(`sent`, `reply`)으로 기록한다. 스크립트는 가게 정보와 조회 데이터로만 채우고 모르는 칸은 `[확인 필요]`로 둔다.
- **서류 질문**("영업신고에 필요한 서류가 뭐예요?", "근로계약서 양식 어디서 받아요?"): 해당 항목의 `documents[]`를 근거로 서류 이름·받는 곳·찾는 방법·기관 전화번호를 답하고 서류함으로 가는 `navigate` 제안을 붙인다. 링크와 안내는 규칙 묶음의 값만 쓰고 AI가 만들지 않는다. 서식을 대신 작성하거나 제출한다고 답하지 않는다.
- **"오늘 뭐부터 하죠?"**: 결정할 것 1개와 직접 할 일 1개를 요약한다. 추천 선택지는 `choose_option` 제안으로 붙는다. 정렬은 코드(2장 NextStep)가 하고 AI는 문장만 만든다.
- 범위 밖: **세금·4대보험 신고 일정, 대출·금리, 법률 해석, 금액 계산**은 답하지 않고 `oos`로 안내한다. 대출 안내는 제공하지 않는다.

### `GET /api/stores/{store_id}/chat/suggestions` — 추천 질문

```json
{ "items": ["오늘 뭐부터 하죠?", "건물 용도·주류 선택지 뭐가 달라요?", "구청에 전화하기 전에 뭘 준비하죠?", "개업일을 4월 1일로 미루고 싶어요", "부가세는 언제 신고하나요?"] }
```

- 가게의 현재 상태(결정 대기 카드, 개업까지 남은 일수, 고정된 `focus`)로 코드가 고른다. `focus`가 있으면 그 카드에 맞는 후속 질문(왜 이런가요 / 안 하면 어떻게 되나요 / 다른 방법은 없나요 / 전화로 문의할 땐)을 돌려준다.

---

## 9. 상권 분석 [마지막에 구현]

> **현재 범위에서 제외했다.** 핵심·시간되면 기능이 끝난 뒤 구현해 붙인다. 그 전까지 다른 응답(`impacts`·`menus`·`analyze scope`·알림)은 상권 분석에 의존하지 않는다. 아래는 붙일 때의 설계다. 프로토타입 `foundy`의 "상권 분석" 메뉴는 시연용 자리표시다.

**어디에서 사업을 할지 이미 정한 사용자**를 위한 기능이다. 정한 주소(`address`) 주변의 경쟁 가게를 지도에 자동으로 보여 주고, 경쟁 강도와 가격대를 정리한다. 후보 자리 직접 입력·매물 비교(`/sites`)는 없다.

### `GET /api/stores/{store_id}/map`

쿼리: `radius_m` (`100 | 200 | 300`, 기본 300), `category` (`all | 카페 | 음식점`)

```json
{
  "center": { "lat": 37.54, "lng": 127.05 },
  "address": "서울특별시 성동구 성수이로 00 1층",
  "radius_m": 300,
  "shops": [
    { "id": "k0", "name": "빽다방 성수역점", "category": "카페", "sub_category": "빽다방", "distance_m": 0, "coord": { "lat": 37.54515, "lng": 127.05713 }, "place_url": "http://place.map.kakao.com/565393305", "is_franchise": true, "is_example": false }
  ],
  "summary": {
    "total_count": 54,
    "shown_count": 15,
    "within": { "100": 4, "200": 11, "300": 15 },
    "density_per_km2": 191,
    "competition": "mid",
    "categories": [ { "name": "카페", "count": 4 }, { "name": "커피전문점", "count": 2 } ],
    "franchise": { "count": 4, "ratio_pct": 27 },
    "dessert_count": 2,
    "nearest": [ { "name": "빽다방 성수역점", "distance_m": 0 } ]
  },
  "unavailable": { "open_close_trend": { "available": false }, "foot_traffic": { "available": false } },
  "insights": [
    { "text": "프랜차이즈가 4곳(27%)이에요. 같은 가격·메뉴로 맞서면 불리해서, 메뉴나 분위기로 차별화하는 편이 안전해요.", "basis": "가게 이름 규칙 분류" }
  ],
  "field_checks": [ "평일·주말 낮과 저녁에 가게 앞을 지나는 사람을 직접 세어 보기 (유동인구 데이터가 없어요)" ],
  "evidence": [ { "type": "data", "source": "카카오 로컬 카테고리 검색(CE7, FD6)", "fetched_at": "...", "from_cache": false, "from_mock": false } ]
}
```

- `shops`는 카카오 카테고리 검색(CE7 카페, FD6 음식점)의 결과다. 한 번에 최대 45건이라 **총 개수는 `meta.total_count`(`total_count`)로, 마커는 받은 만큼만** 표시한다. 반경 밖 가게는 `distance_m`으로 프론트가 흐리게 처리한다.
- 메뉴·가격은 공개 데이터가 없어 내려주지 않는다. 화면은 `place_url` 링크로 연결한다.
- `competition`(`low | mid | high`)과 밀집도, 프랜차이즈 비율은 **계산·규칙**으로 만든다. 프랜차이즈 판별은 규칙 묶음의 브랜드 목록(`franchise_brands`)으로 가게 이름을 분류한 값이다. AI가 만들지 않는다.
- `insights[]`는 위 숫자에서 규칙으로 만든 "이 자리에서 눈여겨볼 점" 문장(참고용)이고 `basis`를 함께 둔다. 숫자는 조회·계산 값만 쓴다.
- 데이터가 없는 지표(폐업 추이·유동인구)는 숫자를 지어내지 않고 `available: false`로 둔다. 화면은 "데이터 없음"으로 표시한다.
- 지도 SDK가 로드되지 않으면 프론트는 지도 없이 `summary`와 목록만 보여 준다.
- 주소를 바꾸면(`PATCH /stores`) `impacts`에 `market`이 들어가고 이 화면도 다시 계산된다.

## 10. 가격대·메뉴 (상권 분석) [마지막에 구현 · 예시]

### `GET /api/stores/{store_id}/market`

쿼리: `my_price` (선택, 내 아메리카노 가격 원)

```json
{
  "is_example": true,
  "example_notice": "예시 데이터입니다. 실제 조회 결과가 아닙니다.",
  "radius_m": 300,
  "price_distribution": { "americano": { "min": 2000, "median": 4500, "max": 6500 } },
  "position": { "level": "low", "diff_from_median_krw": -1500, "text": "중앙값 4,500원보다 1,500원 낮아요 · 저가 구간" },
  "area_average_rent": { "is_example": true, "per_m2_krw": 72000, "as_of": "2026-Q3" }
}
```

- 주변 가게의 메뉴·가격은 공개 데이터가 없어서 **예시 분포**로 비교한다. `my_price`를 넣으면 구간(`low` 3,500원 미만 / `mid` 5,500원 이하 / `high`)과 중앙값과의 차이를 계산 도구가 계산한다. AI는 숫자를 만들지 않는다.
- 내 가격은 `PATCH /stores/{store_id}`의 `answers.my_americano_krw`로 저장한다 (다시 반영 없음).
- 동종 업소 목록과 거리는 `/map`에서 실제 조회가 가능하다. 이 엔드포인트의 가격 분포와 지역 평균 임대료만 예시로 남는다.
- 민간 상권 서비스(예: 오픈업)의 데이터는 약관상 쓰지 않는다.

---

## 11. 지원사업 [시간되면]

### `GET /api/stores/{store_id}/grants`

쿼리: `filter` (`all | eligible | closing_soon`)

```json
{
  "fetched_at": "2026-11-20T09:00:00+09:00",
  "ok": true,
  "excluded_count": 3,
  "closed_count": 1,
  "items": [
    {
      "grant_id": "kstartup-000000",
      "title": "2027 ○○ 청년 창업 지원사업",
      "source": "K-Startup",
      "url": "https://...",
      "poster": { "url": null, "source": "generated", "credit": null },
      "category": "사업화",
      "region": "전국",
      "amount_text": "최대 1,500만원",
      "deadline": "2027-01-31",
      "eligibility": {
        "result": "partial",
        "decided_by": "ai",
        "checks": [
          { "condition": "만 39세 이하", "result": "pass", "evidence": { "type": "notice", "text": "만 39세 이하 예비·초기 창업자", "url": "https://..." } },
          { "condition": "업력 3년 이내", "result": "pass", "evidence": { "type": "notice", "text": "창업 3년 이내", "url": "https://..." } },
          { "condition": "서울 소재", "result": "unknown", "note": "공고문에서 지역 조건을 확인하지 못했습니다" }
        ]
      },
      "summary": { "who": "…", "how_much": "…", "until": "2027-01-31", "what_to_submit": ["…"], "by": "ai" },
      "added_to_checklist": true
    }
  ]
}
```

- 자격 판정은 **AI가 공고문 데이터 안에서** 한다. 조건마다 `pass | unknown`(명확한 `fail`이 있으면 목록에서 제외)과 공고문 인용을 붙이고, 근거가 없는 조건은 `unknown`으로 두고 주관 기관 확인을 안내한다.
- 나이(`owner_birth_year`)·업력 같은 숫자 조건은 AI가 공고문에서 조건 값을 추출하고, 대조는 **계산 도구**가 한다.
- `eligibility.result`: `eligible | partial | unknown` (2장)
- 마감일은 체크리스트에 `source: grant`로 자동 추가된다.
- `ok: false`면 공고 조회에 실패한 것이다 (`items`는 빈 배열). `closed_count`는 마감이 지나 뺀 공고 수다.
- 조건을 뽑을 때 AI가 인용한 공고문 문장이 **원문에 실제로 있는지** 서버가 검증하고, 없거나 숫자 조건의 숫자가 인용에 없으면 그 조건은 `unknown`이다. 이 경우 `evidence`는 `null`이다.
- 나이는 생년만 입력받아서 만 나이가 모호하다. 경계에서는 `fail`이 아니라 `unknown`이고 `note`에 "생일에 따라 달라져요"가 들어간다.
- 마감일이 지나지 않은 `eligible`·`partial` 공고만 체크리스트에 들어가고(`added_to_checklist: true`), `unknown`은 들어가지 않는다.
- 화면은 **포스터 카드 그리드**(포스터·신청 가능성 배지·마감 D-day·누가/얼마/언제까지/제출물 요약·조건 칩), 리스트, 마감 달력 세 가지 보기를 갖는다. 상세 창에는 포스터 원본, 조건별 공고문 인용, 제출서류, 신청 링크, 제외된 공고 건수(`excluded_count`)를 보여 준다.
- `filter`(`all | eligible | closing_soon`)는 백엔드가 저장된 결과에서 거른다. 분야(`category`: 사업화 / 융자 / 공간 / 교육 / 멘토링)·지역·정렬(`sort`: `deadline | fit`)은 프론트가 목록에서 거른다.
- `poster`: 공고 응답에 이미지가 있으면 `{ "url": "…", "source": "api", "credit": "주관 기관" }`로 내려주고, 없으면 `url: null`, `source: "generated"`로 두어 화면이 제목·기관·마감으로 포스터형 카드를 만든다. 이미지는 출처 표시와 원문 링크를 함께 둔다. K-Startup 응답에 이미지·첨부 필드가 있는지는 프로브로 확인한다.

---

## 12. 알림 [핵심: 조회 / 시간되면: 재조회]

### `GET /api/stores/{store_id}/alerts`

쿼리: `type` (선택, 아래 유형), `as_of` (선택, `YYYY-MM-DD`. 시연용 시점 이동)

```json
{
  "as_of": "2026-11-19",
  "items": [
    { "alert_id": "al-01", "type": "next", "title": "“건물 용도·주류” 완료 · 다음 할 일 5개", "body": "결정하기 · 상표 점검 → 전화로 문의하기 → …", "cta": { "label": "카드 열기", "page": "report", "item_id": "r-01" }, "is_example": false, "read": false, "created_at": "..." },
    { "alert_id": "al-02", "type": "change", "title": "가게 정보를 바꿔 다시 반영했어요", "body": "주소: …성수이로 12 → …성수이로 99 · 건물 용도·주류 카드 선택 초기화", "cta": { "label": "마이페이지 열기", "page": "mypage" }, "is_example": false, "read": false, "created_at": "..." }
  ]
}
```

- `type`(화면의 탭): `decision`(결정 필요: 선택지가 있는데 아직 고르지 않은 카드) | `next`(다음 할 일: 카드를 `sent`·`done`으로 바꿀 때 남는 알림) | `deadline`(마감 임박: 체크리스트 기한·지원사업 마감) | `change`(변경 감지: 다시 조회로 달라진 점, 마이페이지에서 정보를 바꿔 다시 반영한 기록) | `grant`(새 지원사업). 이전 값은 `grant_new → grant`, `grant_deadline·checklist → deadline`, `data_changed → change`로 합쳤다.
- 모든 알림에는 **바로 처리할 곳**(`cta`: 라벨·화면·항목 id)을 붙인다. "결정 대기 → 카드 열기", "영업신고 D-7 → 체크리스트 열기"처럼 알림이 곧 다음 행동이어야 한다.
- 알림은 서버가 상태에서 만든다. `decision`은 결정 대기 카드가 있는 동안 유지되고 선택하면 사라진다. `next`는 `POST /report/items/{id}/action` 때 만들고 `pending`으로 되돌리면 지운다. `change`는 `PATCH /stores`와 다시 조회에서 만든다.
- **시점 이동(시연용)**: `as_of`를 개업 D-7이나 개업 6개월 후 날짜로 주면 그 날짜 기준으로 기한·마감 알림(체크리스트 D-7, 부가세·위생교육 갱신 확인, 새 지원사업. 월간 상권 요약은 상권 분석을 붙인 뒤)을 만들어 돌려준다. 시간이 지나야 발생하는 알림은 모두 `is_example: true`이고, 화면은 "예시" 배지를 붙인다. 부가세 신고 기한 같은 정확한 날짜는 AI가 지어내지 않고 "국세청 안내로 확인하세요"로 둔다.
  - 규칙(코드): **기한 알림**은 어떤 `as_of`에도 같은 규칙으로, 완료하지 않은 체크리스트 항목 중 기한이 지났거나 `as_of` + 14일 이내(14일째 포함)인 항목을 `type: deadline`으로 만든다 (숨긴 카테고리 제외, 기한이 이른 순). 제목은 `“{항목}” D-n` / `오늘 마감` / `기한 n일 지남`, `cta`는 `{label:'체크리스트 열기', page:'checklist', item_id}`.
  - **개업 후 알림**(부가세 신고 시기·위생교육 갱신 확인)은 `backend/mocks/alerts_as_of.json`에서 읽고, `as_of`가 개업일에서 **달력상 6개월**(그 달에 같은 날짜가 없으면 말일. 예: 8/31 → 2/28 또는 2/29) 이후일 때 붙인다. 날짜는 넣지 않고 공식 안내(홈택스, 관할 구청 위생과·교육기관)를 확인하도록 쓴다. `cta`는 외부 링크를 지원하지 않아 부가세는 체크리스트 목록(`item_id` 없음), 위생교육은 `c-05`로 연결한다.
  - 예시 알림은 **저장하지 않고** 응답 앞에 붙인다. 그 뒤에 저장된 알림이 기존처럼 최신순으로 온다. `type` 필터는 예시 알림에도 적용한다. 응답의 `as_of`는 요청한 날짜다.
  - 예시 알림의 `alert_id`는 `ex-`로 시작하고(예: `ex-dl-c-04`, `ex-vat`), `read`는 항상 `false`, `created_at`은 `as_of` 날짜 09:00(+09:00)이다. 저장된 알림이 아니므로 `PATCH /alerts/{alert_id}`는 `404`다 (읽음 표시는 화면에서만). 대시보드의 안 읽은 알림 수에는 들어가지 않는다.
  - 예시 계정의 저장된 알림도 `is_example: true`이므로, 시점 이동 예시 알림인지는 `alert_id`의 `ex-` 접두사로 구별한다.
  - 잘못된 날짜(`2027-02-30`, `YYYY-MM-DD`가 아닌 형식)는 `400 INVALID_INPUT`.

### `PATCH /api/stores/{store_id}/alerts/{alert_id}`

```json
{ "read": true }
```

### `POST /api/stores/{store_id}/refresh` — 다시 조회하고 바뀐 것만 알림 [시간되면]

응답 `202`: `{ "run_id": "…" }` (`runs.trigger = refresh`)

- 이전 실행 결과와 비교해 바뀐 항목만 `alerts`에 `data_changed`로 쌓는다.
- 시연에서는 이 수동 버튼으로 "개업 후에도 먼저 알려준다"를 보여준다.

### `POST /internal/refresh` — 예약 재조회 [로드맵]

- 헤더 `Authorization: Bearer {INTERNAL_TOKEN}` 필수
- 저장된 가게 전체(데모 제외)에 대해 `refresh` 실행. GitHub Actions cron이 하루 1회 호출.

---

## 13. 데모와 헬스체크 [핵심]

### `POST /api/demo` — 예시로 해보기 / 예시 계정 (이서연 씨 사례)

로그인 화면의 "예시 계정으로 둘러보기"와 첫 설정 화면의 "예시로 해보기"가 같은 엔드포인트를 쓴다.

응답 `201`

```json
{ "access_token": "…", "user": { "user_id": "demo-…", "name": "이서연", "provider": "demo" }, "store_id": "demo-…", "run_id": "…", "cached": true }
```

- 미리 저장해 둔 결과를 복사해 새 `store_id`로 만든다 (`is_demo: true`). **가입·로그인 없이** 접속할 수 있고, 외부 API가 전부 실패해도 동작해야 한다. 체크리스트는 2개 완료 상태로 시작한다.
- 프론트는 `/stores/{store_id}?demo=1`로 이동하고, SSE는 저장된 이벤트를 짧은 간격으로 재생한다.

### `GET /api/health`

```json
{ "status": "ok", "mock": false, "db": "ok", "version": "0.1.0" }
```

---

## 14. 프론트 화면과 API 매핑

| 화면 (경로) | 호출 API | 범위 |
| --- | --- | --- |
| 로그인 `/login` (아이디·비밀번호, 예시 계정) | `POST /auth/login`, `POST /demo`, `GET /me` | 핵심 |
| 회원가입 `/signup` | `POST /auth/signup` | 핵심 |
| 첫 설정 `/start` (로그인 후 가게가 없을 때. 이름·업종·주소·개업일·출생연도 → 되묻기(술·테라스·직원·준비 자금) → 조사 중) | `POST /stores`, `POST /stores/{id}/answers` | 핵심 |
| 조사 중 `/stores/{id}/run/{runId}` (첫 설정·마이페이지 재반영 공용) | `POST /stores/{id}/analyze`, `GET /runs/{runId}/stream`, `GET /runs/{runId}` | 핵심 |
| 내 가게 홈 `/stores/{id}` (결정할 것·직접 할 일·다음 할 일) | `GET /stores/{id}/dashboard`, `POST /report/items/{itemId}/choose` | 핵심 |
| 점검 리포트 `/stores/{id}/report` (결정 → 실행 → 완료, 다음으로 할 일, 체크리스트 자동 체크) | `GET /report`, `POST /report/items/{itemId}/choose`, `POST /report/items/{itemId}/action` | 핵심 |
| 개업 체크리스트 `/stores/{id}/checklist` (시기별·카테고리별·달력. 달력은 같은 응답의 `due_date`와 개업일로 프론트가 그리고 `.ics`는 프론트에서 생성) | `GET /checklist`, `PATCH /checklist/{itemId}` | 핵심 |
| 서류함 `/stores/{id}/documents` (항목별 필요 서류, 받는 곳 공식 사이트 링크 새 탭, 찾는 방법, 기관 전화번호 복사. 읽기 전용) | `GET /documents` | 핵심 |
| 알림 센터 `/stores/{id}/alerts` (유형 탭·액션 버튼·시점 이동 시연) | `GET /alerts?type=&as_of=`, `PATCH /alerts/{alertId}` | 핵심 / 개업 후 알림은 예시 |
| 마이페이지 `/me` (계정, 가게 정보·영업 조건 수정, 영향 미리보기, 최근 변경, 로그아웃, 가게 정보 다시 설정) | `GET /me`, `PATCH /me`, `GET /stores/{id}`, `PATCH /stores/{id}`, `GET /stores/{id}/changes` | 핵심 |
| AI 상담 `/stores/{id}/chat` (질문 대상 고정, 추천 질문, 제안 카드, 통화 준비) | `POST /chat`, `GET /chat/suggestions`, 제안 확인 시 `PATCH /stores/{id}`·`POST /report/items/{id}/choose`·`PATCH /checklist/{id}` | 시간되면 |
| 상권 분석 `/stores/{id}/market` (지도, 상권 요약, 경쟁 강도, 가격 포지셔닝, 눈여겨볼 점, 현장 확인) | `GET /map`, `GET /market` | 마지막에 구현 (`/market`은 예시) |
| 지원사업 `/stores/{id}/grants` (포스터 카드·필터·정렬·보기 전환) | `GET /grants` | 시간되면 |
| 다시 조회 (내 가게의 버튼) | `POST /refresh` | 시간되면 |
