# API 명세서

# 청년 창업가 종합 솔루션 — API 명세서

> 프론트(React/Next.js) ↔ 백엔드(FastAPI) 사이의 약속 문서
구조·인프라·데이터 모델·외부 API 연동은 `아키텍처_인프라.md` 참고
이 문서의 응답 형식을 바꾸면 같은 PR에서 프론트와 백엔드를 함께 수정한다
> 

### 변경 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-11-17 | 최초 작성 |
| 2026-11-18 (결과 카드) | 점검 리포트 항목을 **"결과물 + 결정 한 번"** 구조로 변경: `consequence`, `options[]`, `recommendation`, `prepared[]`, `user_action`, `chosen_option` 추가, `next_action` 제거. 선택지 적용 `POST /report/items/{id}/choose` 추가, SSE `advise` step 추가, 대시보드 `pending_decisions` 추가, 체크리스트 항목에 `prepared`(신고서류 초안) 추가, 챗봇 `choose_option` 액션 추가 |
| 2026-11-18 | 아키텍처 문서(11-18)에 맞춰 전면 갱신: 일정표·신고를 **개업 체크리스트**(`/checklist`)로 통합, 항목별 질문(`/report/items/{id}/ask`)을 **내 가게 챗봇**(`/chat`)으로 확장, **입지·상권 지도와 매물 비교**(`/map`, `/sites`) 추가, **대출 안내 삭제**(`/loans`), **지원사업 자격 판정은 AI가 데이터에 근거해 판정**(`decided_by: ai`), 자격 값을 `eligible / partial / unknown`으로 통일(`ineligible` 삭제), 깨져 있던 화면-API 매핑표 복구 |

### 범위 표기

| 표기 | 의미 |
| --- | --- |
| **[핵심]** | 예선 링크에서 실제 데이터로 동작해야 함 |
| **[시간되면]** | 핵심 완료 후 실제 데이터로 연결 |
| **[예시]** | 예시 데이터로 화면만 시연. 응답에 `is_example: true` |
| **[로드맵]** | 구현하지 않음 |
| **제외** | 만들지 않음 (대출 안내) |

### 엔드포인트 한눈에 보기

| 메서드 | 경로 | 설명 | 범위 |
| --- | --- | --- | --- |
| POST | `/api/stores` | 가게 등록 + 되묻기 질문 | 핵심 |
| POST | `/api/stores/{store_id}/answers` | 되묻기 답변 | 핵심 |
| GET | `/api/stores/{store_id}` | 가게 정보 | 핵심 |
| PATCH | `/api/stores/{store_id}` | 가게 정보 수정 (개업일 변경 시 체크리스트 날짜 재계산) | 핵심 |
| POST | `/api/stores/{store_id}/analyze` | 분석 실행 | 핵심 |
| GET | `/api/runs/{run_id}/stream` | 진행 상황 SSE | 핵심 |
| GET | `/api/runs/{run_id}` | 실행 상태 (SSE 대체 폴링) | 핵심 |
| GET | `/api/stores/{store_id}/dashboard` | 내 가게 대시보드 | 핵심 |
| GET | `/api/stores/{store_id}/report` | 점검 리포트 (결과 카드: 선택지·추천·대신 만든 결과물) | 핵심 |
| POST | `/api/stores/{store_id}/report/items/{item_id}/choose` | 리포트 항목의 선택지 적용 (추천대로 진행 등) | 핵심 |
| GET | `/api/stores/{store_id}/checklist` | 개업 체크리스트 (시기별·카테고리별) | 핵심 |
| PATCH | `/api/stores/{store_id}/checklist/{item_id}` | 체크리스트 완료 체크 | 핵심 |
| GET | `/api/stores/{store_id}/alerts` | 알림 목록 | 핵심 |
| PATCH | `/api/stores/{store_id}/alerts/{alert_id}` | 알림 읽음 처리 | 핵심 |
| POST | `/api/demo` | 예시로 해보기 (이서연 씨 사례) | 핵심 |
| GET | `/api/health` | 헬스체크 | 핵심 |
| POST | `/api/stores/{store_id}/chat` | 내 가게 챗봇 | 시간되면 |
| GET | `/api/stores/{store_id}/grants` | 정책 알림 (지원사업 자격 판정) | 시간되면 |
| GET | `/api/stores/{store_id}/map` | 입지·상권 지도 (후보 자리, 주변 동종 가게) | 시간되면 |
| POST | `/api/stores/{store_id}/sites` | 후보 자리 추가 | 시간되면 |
| PATCH | `/api/stores/{store_id}/sites/{site_id}` | 후보 자리 수정 (매물 정보 입력, 기준 자리 지정) | 시간되면 |
| DELETE | `/api/stores/{store_id}/sites/{site_id}` | 후보 자리 삭제 | 시간되면 |
| POST | `/api/stores/{store_id}/sites/compare` | 매물 비교 (비용 합산, 평균 대비, 현장 질문) | 시간되면 |
| GET | `/api/stores/{store_id}/market` | 상권 분석의 메뉴·가격대, 지역 평균 임대료 | 예시 |
| POST | `/api/stores/{store_id}/refresh` | 다시 조회 → 바뀐 것만 알림 | 시간되면 |
| POST | `/internal/refresh` | 예약 재조회 (토큰 보호) | 로드맵 |

---

## 1. 공통 규칙

- Base URL: `{NEXT_PUBLIC_API_BASE_URL}/api`
- 형식: JSON, UTF-8. 날짜는 `YYYY-MM-DD`, 시각은 ISO 8601(+09:00)
- 인증: 없음 (예선 프로토타입). 가게는 `store_id`(UUID)로 식별한다. `/internal/*`만 `Authorization: Bearer {INTERNAL_TOKEN}`
- 성공 응답: 리소스 JSON을 그대로 반환
- 에러 응답:

```json
{ "error": { "code": "STORE_NOT_FOUND", "message": "가게를 찾을 수 없습니다." } }
```

| HTTP | code | 상황 |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | 필수값 누락, 날짜 형식 오류 |
| 404 | `STORE_NOT_FOUND`, `RUN_NOT_FOUND`, `SITE_NOT_FOUND`, `ITEM_NOT_FOUND` |  |
| 409 | `RUN_IN_PROGRESS` | 같은 가게의 분석이 이미 실행 중 |
| 422 | `ADDRESS_NOT_RESOLVED` | 주소를 코드로 바꾸지 못함 |
| 429 | `RATE_LIMITED` | 외부 API 한도 초과 (가능하면 캐시·mock으로 대체하고 에러를 내지 않음) |
| 500 | `INTERNAL_ERROR` |  |

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
- 캐시·모의 응답을 쓴 근거는 `from_cache` / `from_mock`을 `true`로 표시하고 화면에 드러낸다.

### Verdict (점검 리포트 판정)

| 값 | 화면 표시 | 의미 |
| --- | --- | --- |
| `high` | 위반 소지 높음 | **규칙 묶음**이 데이터로 문제를 확인한 경우만 |
| `low` | 위반 소지 낮음·확인 권장 | AI 판단이거나 데이터가 일부만 있음 (AI 판정의 상한) |
| `unknown` | 판단 불가 | 근거를 찾지 못함 → 관할 기관 확인 안내 |
| `ok` | 문제 없음 | 통과 (항목은 숨기지 않고 접어서 표시) |

- `decided_by`: `rule`(규칙 묶음) | `ai`(AI 판정). `decided_by: ai`인 항목은 `high`가 될 수 없다.

### 결과 카드 객체 (점검 리포트 항목의 추가 필드)

리포트 항목은 판정만 보여주지 않고 **"결과물 + 결정 한 번"** 형태로 내려간다. 에이전트가 조사·비교·작성까지 하고, 사용자 몫은 결정·서명·방문으로 줄인다.

| 필드 | 설명 |
| --- | --- |
| `title` | 결론 한 줄. 법 용어 대신 결과 중심의 쉬운 말 ("이 자리에서는 술을 팔 수 없어요") |
| `reason` | 이유를 한두 문장으로 |
| `consequence` | 안 하면 생기는 일 (돈·시간 기준) |
| `options[]` | 선택지. 각 선택지는 아래 Option 참고. 만들 수 없으면 빈 배열 |
| `recommendation` | `{ option_id, reason }`. 추천 선택지 하나와 이유. 선택지가 없으면 `null` |
| `prepared[]` | 에이전트가 대신 만들어 둔 결과물 (Prepared) |
| `user_action` | 사용자가 할 일 **1개**와 소요 시간 (UserAction) |
| `chosen_option` | 사용자가 고른 `option_id`. 아직이면 `null` |

**Option**

```json
{
  "option_id": "o-3",
  "label": "후보 자리 B로 변경",
  "summary": "B는 1층 제2종 근린생활시설이라 일반음식점 신고가 가능해요.",
  "time": { "text": "즉시", "basis": "data" },
  "cost": { "text": "월 고정비 +300,000원", "delta_krw": 4000000, "basis": "calc" },
  "apply": { "type": "set_main_site", "payload": { "site_id": "st-02" }, "needs_reanalyze": true },
  "site_id": "st-02",
  "remedy": "change_site"
}
```

- `remedy`: 이 선택지가 규칙 묶음의 어떤 대응 유형(`remedies`)인지. 서버가 허용된 유형만 남기는 검증에 쓰고, 화면에는 보여주지 않는다.
- `apply.type`: `update_store`(가게 정보·답변 수정) | `set_main_site`(기준 자리 변경) | `none`(기록만)
- `time`, `cost`: **근거가 있을 때만 숫자를 쓴다.** `basis`는 `rule | calc | data | notice | null`이고, `null`이면 `text`를 "확인 필요"로 내리고 `delta_krw`는 `null`로 둔다. AI가 기간·금액을 추정해서 채우지 않는다.
- 금액 차이(`delta_krw`)와 월 고정비 같은 숫자는 계산 도구가 계산한다. 선택지의 문장과 추천 이유만 AI가 쓴다.
- 선택지의 종류는 규칙 묶음의 해당 점검 항목에 적힌 `remedies`(가능한 대응 유형) 범위 안에서만 만든다. 후보 자리 선택지(`site_id`)는 후보 자리가 있을 때만 나온다.
- 후보 자리가 없는데 자리 변경이 맞는 대응이면 `"label": "후보 자리 추가해 비교하기"`, `apply.type: none`으로 내려주고 `/sites` 흐름으로 안내한다.

**Prepared**

```json
{ "prepared_id": "p-01", "kind": "inquiry_message", "title": "구청 건축과 문의 문자", "body": "…", "editable": true }
```

- `kind`: `inquiry_message`(문의 문자·전화 스크립트) | `contract_clause`(임대차 특약 문구) | `document_draft`(신고서류 초안) | `link`(열람·신청 링크, `url` 사용)
- 초안은 **가게 정보와 조회 데이터를 문장에 채워 넣는 것**으로 제한한다. 조회하지 않은 사실을 새로 쓰지 않고, 모르는 칸은 `[확인 필요]`로 비워 둔다.
- 법률 효력이 있는 문서(특약 문구 등)에는 "참고용 초안입니다. 계약 전에 전문가 확인을 권장합니다" 문구를 `body` 끝에 붙인다.

**UserAction**

```json
{ "type": "send", "text": "구청에 문의 문자 보내기", "est_minutes": 1, "prepared_id": "p-01" }
```

- `type`: `send`(보내기) | `sign`(서명·제출) | `visit`(방문) | `decide`(결정)
- 정부24 제출, 서명, 구청 방문은 자동화할 수 없는 영역이다. 서비스는 이 단계 전까지를 대신하고 `user_action`에는 사용자가 직접 해야 하는 일 하나만 적는다.

### 지원사업 자격 판정 (Eligibility)

| 값 | 화면 표시 | 의미 |
| --- | --- | --- |
| `eligible` | 신청 가능성 높음 | 확인된 조건이 모두 충족 |
| `partial` | 일부 확인 필요 | 충족한 조건이 있고 확인하지 못한 조건이 남음 |
| `unknown` | 판단 불가 | 근거 부족. 공고문 원문·주관 기관 확인 안내 |

- 자격 판정은 **AI가 조회한 공고문 안에서** 하고, 조건마다 공고문 문장을 인용한다. 나이·업력 같은 숫자 조건 대조는 계산 도구가 수행해 AI가 결과를 받는다.
- 조건 한 건이라도 명확히 충족하지 못하면(`fail`) 그 공고는 목록에서 제외하고 `excluded_count`로만 알린다.

---

## 3. 가게 등록과 되묻기 [핵심]

### `POST /api/stores` — 가게 등록

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

응답 `201`

```json
{
  "store_id": "8f2c...",
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
    { "id": "funds_krw", "text": "준비된 자금은 얼마인가요?", "type": "number", "optional": true, "why": "지원사업 안내와 매물 비교의 버틸 수 있는 기간 계산에 씁니다." }
  ]
}
```

- `questions`는 규칙 묶음의 후보 중 AI가 고른 것. 이미 답이 있는 것은 빠진다.
- 주소 변환 실패 시 `422 ADDRESS_NOT_RESOLVED`와 후보 주소 목록을 함께 반환.

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
  "questions": []
}
```

- 답에 따라 추가 질문이 생기면 `questions`에 다시 담는다. 비어 있으면 분석을 시작할 수 있다.
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

### `PATCH /api/stores/{store_id}` — 가게 정보 수정

요청 (바꿀 필드만)

```json
{ "opening_date": "2027-04-01" }
```

응답 `200`: 수정된 가게 + `"recomputed": ["checklist"]`

- 개업일 변경은 외부 API를 다시 부르지 않고 **계산 도구**로 체크리스트 날짜만 재계산한다.
- 주소·업종·답변 변경은 `"needs_reanalyze": true`를 반환한다.
- 챗봇이 제안한 조건 변경도 사용자가 확인한 뒤 이 엔드포인트로 반영한다 (`/chat`의 `actions` 참고).

---

## 4. 분석 실행과 진행 스트리밍 [핵심]

### `POST /api/stores/{store_id}/analyze`

요청

```json
{ "scope": ["building", "law", "trademark", "checklist", "grants", "location"] }
```

- `scope` 생략 시 핵심 전체(`building`, `law`, `trademark`, `checklist`). `grants`, `location`은 구현 여부에 따라 무시될 수 있다.

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
data: {"check_id":"building_use","verdict":"high","decided_by":"rule","title":"이 자리에서는 술을 팔 수 없어요","has_options":true}

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
| `rules` | 규칙 묶음 판정 (업종 구분, 건물 용도) |
| `interpret` | AI 판정·요약 (해당 신고·인허가, 위험) |
| `advise` | 선택지·추천·문의 문자·서류 초안 생성 (판정이 `ok`가 아닌 항목) |
| `checklist` | 개업일 역산 체크리스트 생성 (계산 도구) |
| `grants` | 지원사업 조회·AI 자격 판정 |
| `location` | 입지 데이터 |
- `status`: `running | done | fallback | skipped | failed`. `fallback`은 캐시·mock으로 대체했다는 뜻이고 화면에 표시한다.
- 스트림이 끊기면 `GET /api/runs/{run_id}`로 상태와 `events`를 폴링한다.

### `GET /api/runs/{run_id}` — 실행 상태

```json
{ "run_id": "a91d...", "trigger": "user", "status": "done", "events": [ ... ], "started_at": "...", "finished_at": "..." }
```

- `trigger`: `user | refresh | chat | demo`

---

## 5. 내 가게 대시보드 [핵심]

### `GET /api/stores/{store_id}/dashboard`

```json
{
  "store": { "store_id": "8f2c...", "name": "모노커피", "business_type": "일반음식점", "opening_date": "2027-03-02", "d_day": -102 },
  "last_run": { "run_id": "a91d...", "finished_at": "2026-11-20T14:05:00+09:00" },
  "report_summary": { "high": 1, "low": 3, "unknown": 1, "ok": 7 },
  "pending_decisions": [
    { "item_id": "r-01", "title": "이 자리에서는 술을 팔 수 없어요", "verdict": "high", "recommended_option": "후보 자리 B로 변경" }
  ],
  "today_todos": [
    { "item_id": "c-01", "task": "구청에 문의 문자 보내기", "due_date": "2027-01-05", "category": "건물·시설", "est_minutes": 1, "prepared_id": "p-01" }
  ],
  "checklist_progress": { "done": 2, "total": 9 },
  "alerts": { "unread": 2, "latest": [ { "title": "청년 창업 지원사업 새 공고", "type": "grant_new", "is_example": false } ] },
  "menus": {
    "report": "ready",
    "checklist": "ready",
    "chat": "ready",
    "map": "not_requested",
    "market": "example",
    "grants": "ready"
  }
}
```

- `menus` 값: `ready | not_requested | example | unavailable`. `example`은 화면에 "예시 데이터" 배지를 붙인다.
- `d_day`는 개업일까지 남은 일수를 음수로 표현한다 (개업일 당일 0).
- `pending_decisions`: 선택지가 있는데 아직 `chosen_option`이 없는 리포트 항목. 대시보드 첫 화면에서 "결정할 것"으로 보여주고 카드를 열면 `[추천대로 진행]`을 바로 누를 수 있다.
- `today_todos`는 사용자가 직접 해야 하는 일(`user_action`)을 보여준다. "~를 확인하세요" 대신 "구청에 문의 문자 보내기 (1분)"처럼 구체적인 행동과 소요 시간, 대신 만든 결과물(`prepared_id`)을 함께 둔다.

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
          "decided_by": "rule",
          "reason": "술을 팔려면 일반음식점으로 신고해야 하는데, 이 건물 1층은 휴게음식점(카페)까지만 가능한 제1종 근린생활시설이에요.",
          "consequence": "이대로 계약하면 영업신고가 반려돼 보증금이 묶일 수 있어요.",
          "options": [
            {
              "option_id": "o-1", "label": "술 빼고 카페로 시작", "summary": "휴게음식점으로 신고합니다. 바로 가능해요.",
              "time": { "text": "즉시", "basis": "rule" },
              "cost": { "text": "추가 비용 없음", "delta_krw": 0, "basis": "rule" },
              "apply": { "type": "update_store", "payload": { "answers": { "sells_alcohol": false } }, "needs_reanalyze": true },
              "site_id": null
            },
            {
              "option_id": "o-2", "label": "용도변경 신청", "summary": "구청 승인과 건물주 동의가 필요해요.",
              "time": { "text": "확인 필요", "basis": null },
              "cost": { "text": "확인 필요", "delta_krw": null, "basis": null },
              "apply": { "type": "none" },
              "site_id": null
            },
            {
              "option_id": "o-3", "label": "후보 자리 B로 변경", "summary": "B는 1층 제2종 근린생활시설이라 일반음식점 신고가 가능해요.",
              "time": { "text": "즉시", "basis": "data" },
              "cost": { "text": "월 고정비 +300,000원, 초기 비용 +4,000,000원", "delta_krw": 4000000, "basis": "calc" },
              "apply": { "type": "set_main_site", "payload": { "site_id": "st-02" }, "needs_reanalyze": true },
              "site_id": "st-02"
            }
          ],
          "recommendation": { "option_id": "o-3", "reason": "①은 주류 매출을 포기해야 하고, ②는 개업일(3/2) 안에 끝난다는 보장이 없어요." },
          "prepared": [
            { "prepared_id": "p-01", "kind": "inquiry_message", "title": "구청 건축과 문의 문자", "body": "성동구 성수이로 00 1층 건물의 용도가 일반음식점 영업에 적합한지 확인하고 싶습니다…", "editable": true },
            { "prepared_id": "p-02", "kind": "contract_clause", "title": "임대차 특약 문구", "body": "임차 목적물이 일반음식점 영업신고가 불가능한 경우 임차인은 계약을 해지할 수 있고, 임대인은 보증금을 전액 반환한다.", "editable": true },
            { "prepared_id": "p-03", "kind": "link", "title": "건축물대장 열람", "url": "https://www.gov.kr/..." }
          ],
          "user_action": { "type": "send", "text": "구청에 문의 문자 보내기", "est_minutes": 1, "prepared_id": "p-01" },
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
            { "option_id": "o-1", "label": "이름 바꾸기", "summary": "겹치지 않는 후보: ○○, △△", "time": { "text": "즉시", "basis": "rule" }, "cost": { "text": "간판 제작 전이면 추가 비용 없음", "delta_krw": 0, "basis": "rule" }, "apply": { "type": "update_store", "payload": { "name": "○○" }, "needs_reanalyze": true }, "site_id": null },
            { "option_id": "o-2", "label": "그대로 진행", "summary": "위험을 알고 진행합니다.", "time": { "text": "즉시", "basis": "rule" }, "cost": { "text": "확인 필요", "delta_krw": null, "basis": null }, "apply": { "type": "none" }, "site_id": null }
          ],
          "recommendation": { "option_id": "o-1", "reason": "간판을 만들기 전이라 지금 바꾸는 비용이 가장 낮아요." },
          "prepared": [
            { "prepared_id": "p-04", "kind": "link", "title": "KIPRIS 유사 상표 2건 보기", "url": "https://..." }
          ],
          "user_action": { "type": "decide", "text": "이름을 바꿀지 정하기", "est_minutes": 3, "prepared_id": null },
          "evidence": [ { "type": "data", "source": "KIPRIS", "value": "등록 4000000000000 '모노 커피' (제43류)", "url": "...", "fetched_at": "..." } ],
          "chosen_option": null,
          "added_to_checklist": []
        },
        {
          "item_id": "r-03",
          "check_id": "building_violation",
          "title": "위반건축물인지 확인할 수 없어요",
          "verdict": "unknown",
          "decided_by": "rule",
          "reason": "건축물대장 응답에 위반건축물 표기 정보가 없어요.",
          "consequence": "위반건축물이면 영업신고가 반려될 수 있어요.",
          "options": [],
          "recommendation": null,
          "prepared": [
            { "prepared_id": "p-05", "kind": "inquiry_message", "title": "구청 건축과 문의 문자 (위반건축물 여부)", "body": "…", "editable": true },
            { "prepared_id": "p-06", "kind": "link", "title": "정부24 건축물대장 열람", "url": "https://www.gov.kr/..." }
          ],
          "user_action": { "type": "send", "text": "구청에 문의 문자 보내기", "est_minutes": 1, "prepared_id": "p-05" },
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

- 항목에 대한 추가 질문("이 항목은 왜 이런가요?")은 챗봇 `/chat`의 `focus`로 한다 (11장).
- `added_to_checklist`: 이 항목에서 파생돼 체크리스트에 추가된 `item_id` 목록 (`checklist_items.report_item_id`).
- **결과 카드 구조**: `verdict`가 `ok`가 아닌 항목은 결론(`title`) → 이유(`reason`) → 안 하면 생기는 일(`consequence`) → 선택지(`options`) → 추천(`recommendation`) → 대신 만든 결과물(`prepared`) → 사용자가 할 일 1개(`user_action`) 순으로 화면에 보여준다. 법 조문과 근거(`evidence`)는 "자세히 보기"로 접어 둔다. 필드 정의는 2장 "결과 카드 객체" 참고.
- `title`은 법 용어 대신 **결과 중심의 쉬운 말**로 쓴다. `verdict: ok` 항목은 `title`과 `reason`만 있으면 된다.
- 선택지를 만들 수 없으면(`options: []`) 문의 문자 같은 `prepared`와 `user_action`만 내려준다.

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
  "applied": [ { "type": "set_main_site", "site_id": "st-02" } ],
  "recomputed": ["checklist"],
  "needs_reanalyze": true,
  "run_id": "b72e..."
}
```

- 사용자가 `[추천대로 진행]` 또는 다른 선택지를 눌렀을 때 호출한다. 서버가 `apply`에 적힌 변경(가게 정보 수정, 기준 자리 변경 등)을 반영한다.
- `needs_reanalyze: true`이면 서버가 곧바로 재분석 실행을 시작하고 `run_id`를 돌려준다 (`runs.trigger = user`). 프론트는 진행 화면으로 이동한다.
- `apply.type`이 `none`인 선택지는 `chosen_option`만 기록한다.
- 이미 선택한 항목을 다시 호출하면 선택을 바꾼다 (이전 선택으로 생긴 변경은 재분석으로 다시 계산된다).

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
          "task": "건물 확인·임대차 계약",
          "category": "건물·시설",
          "dday": -56,
          "due_date": "2027-01-05",
          "documents": ["건축물대장", "임대차계약서"],
          "agency": "관할 구청 건축과",
          "source": "rule",
          "report_item_id": "r-01",
          "evidence": [ { "type": "data", "source": "건축물대장 표제부", "fetched_at": "..." } ],
          "done": false
        }
      ]
    },
    {
      "group_label": "개업 4주 전",
      "items": [
        {
          "item_id": "c-04",
          "task": "일반음식점 영업신고",
          "category": "영업 인허가",
          "dday": -28,
          "due_date": "2027-02-02",
          "documents": ["영업신고서", "위생교육 이수증", "건강진단결과서", "임대차계약서 사본"],
          "agency": "관할 구청 위생과",
          "prepared": [ { "prepared_id": "p-10", "kind": "document_draft", "title": "영업신고서 초안 (가게 정보로 채움)", "body": "…", "editable": true } ],
          "source": "rule",
          "report_item_id": null,
          "evidence": [ { "type": "law", "law_name": "식품위생법", "article": "제37조", "url": "..." } ],
          "done": false
        }
      ]
    },
    { "group_label": "개업 직전", "items": [] },
    {
      "group_label": "개업 후",
      "items": [
        {
          "item_id": "c-09",
          "task": "청년 창업 지원사업 신청 마감",
          "category": "정책",
          "dday": -30,
          "due_date": "2027-01-31",
          "documents": ["사업계획서"],
          "agency": "K-Startup",
          "source": "grant",
          "report_item_id": null,
          "evidence": [ { "type": "notice", "text": "신청 기간: ~2027-01-31", "url": "..." } ],
          "done": false
        }
      ]
    }
  ],
  "hidden_categories": [
    { "category": "고용", "hidden_reason": "직원을 고용하지 않음" }
  ]
}
```

- `group_label`: `계약 전 | 개업 4주 전 | 개업 직전 | 개업 후`. 항목의 `dday`로 서버가 나눈다. `view=category`이면 `groups`가 `category` 기준으로 묶이고 `group_label`은 항목 안에 남는다.
- `category`: `영업 인허가 | 세무 | 고용 | 건물·시설 | 간판·광고 | 표시 의무 | 정책`
- `source`: `rule`(규칙 묶음 기본 항목) | `report`(점검 리포트에서 파생) | `grant`(지원사업 마감)
- 날짜(`due_date`, `dday`)는 규칙 묶음의 `week` 값과 개업일로 **계산 도구**가 계산한다. AI는 날짜를 직접 계산하지 않는다.
- 조건에 맞지 않는 카테고리(예: 직원 없음 → 고용)는 `hidden_categories`로 내려주고 프론트는 숨긴다.
- 필요 서류·담당 기관은 규칙 묶음에 적힌 값이며 근거 링크를 함께 둔다.
- 서류가 필요한 항목에는 `prepared`로 **가게 정보를 채운 신고서류 초안**(`kind: document_draft`)을 함께 내려준다. 채우지 못하는 칸은 `[확인 필요]`로 둔다. 제출은 사용자가 직접 한다 (`user_action.type: sign`).
- 지원사업 마감일은 `source: grant`로 자동 추가된다.

### `PATCH /api/stores/{store_id}/checklist/{item_id}`

```json
{ "done": true }
```

응답 `200`: 수정된 항목

---

## 8. 내 가게 챗봇 [시간되면]

### `POST /api/stores/{store_id}/chat`

요청

```json
{
  "message": "위반건축물이면 아예 못 여는 건가요?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "focus": { "type": "report_item", "id": "r-01" }
}
```

- `history`는 프론트가 보관해 매번 보낸다 (서버는 대화 기록을 저장하지 않는다).
- `focus`는 선택. `report_item` | `checklist_item` | `grant` | `site`를 지정하면 해당 항목을 우선 근거로 삼는다. 리포트 항목의 "이 항목은 왜 이런가요?" 버튼이 이것을 쓴다.

응답 `200`

```json
{
  "answer": "위반건축물로 표기되면 영업 신고가 반려될 수 있습니다. 다만 이 가게 건물은 표기 여부가 확인되지 않았습니다…",
  "evidence": [ { "type": "law", "law_name": "식품위생법", "article": "제37조", "url": "..." } ],
  "actions": [
    {
      "type": "update_store",
      "label": "개업일을 2027-04-01로 변경하고 일정 다시 계산",
      "payload": { "opening_date": "2027-04-01" },
      "requires_confirm": true
    }
  ],
  "note": "이 가게의 조회 결과 안에서만 답했습니다. 최종 판단은 관할 기관에 확인하세요."
}
```

- 답변은 **이 가게에 저장된 근거 안에서만** 한다. 근거 밖이면 "판단 불가"로 답하고 관할 기관을 안내한다.
- 조건 변경(개업일, 직원 유무 등)은 `actions`로 **제안만** 하고, 사용자가 확인하면 프론트가 `PATCH /stores/{store_id}`로 반영한다.
  - 개업일 변경: 응답의 `recomputed: ["checklist"]`로 체크리스트 날짜만 재계산
  - 답변·주소·업종 변경: `needs_reanalyze: true`이면 프론트가 `POST /analyze`를 호출하고 `runs.trigger`는 `chat`으로 기록된다.
- `actions[].type`: `update_store` | `check_item` | `navigate` | `choose_option`
- `choose_option`: 대화 중 "그럼 B 자리로 할게요"처럼 리포트 항목의 선택지를 고르려는 경우. `payload`는 `{ "item_id": "r-01", "option_id": "o-3" }`이고, 사용자가 확인하면 프론트가 `POST /report/items/{item_id}/choose`를 호출한다.

---

## 9. 입지·상권 지도와 매물 비교 [시간되면]

### `GET /api/stores/{store_id}/map`

내 가게와 후보 자리, 주변 동종 가게를 지도에 표시하는 데이터.

쿼리: `radius_m` (기본 300)

```json
{
  "center": { "lat": 37.54, "lng": 127.05 },
  "radius_m": 300,
  "sites": [
    {
      "site_id": "st-01",
      "label": "A",
      "address": "서울특별시 성동구 성수이로 00",
      "coord": { "lat": 37.54, "lng": 127.05 },
      "is_main": true,
      "building_check": { "verdict": "ok", "summary": "1층 제2종근린생활시설" },
      "area_metrics": {
        "same_type_count": 14,
        "open_close_trend": { "opened_1y": null, "closed_1y": null, "available": false },
        "foot_traffic": { "available": false }
      },
      "listing": null,
      "listing_result": null
    }
  ],
  "nearby_shops": [
    { "name": "○○카페", "category": "카페", "distance_m": 120, "coord": { "lat": 37.54, "lng": 127.05 } }
  ],
  "evidence": [ { "type": "data", "source": "소상공인 상가(상권)정보", "fetched_at": "...", "from_cache": false, "from_mock": false } ]
}
```

- 데이터가 없는 지표는 숫자를 지어내지 않고 `available: false`로 내려준다. 화면에는 "데이터 없음"으로 표시한다.
- 지도 SDK가 로드되지 않으면 프론트는 지도 없이 `sites`를 표로 보여준다.

### `POST /api/stores/{store_id}/sites` — 후보 자리 추가

```json
{ "address": "서울특별시 성동구 아차산로 00", "address_detail": "2층" }
```

응답 `201`: 생성된 site (`label` 자동 부여 A, B, …, 주소→좌표 변환 + 건물 확인 + 반경 내 동종 업소 수 조회). 주소 변환 실패 시 `422 ADDRESS_NOT_RESOLVED`.

### `PATCH /api/stores/{store_id}/sites/{site_id}` — 후보 자리 수정

```json
{
  "is_main": true,
  "listing": { "deposit_krw": 30000000, "monthly_rent_krw": 2500000, "maintenance_krw": 200000, "premium_krw": 10000000, "area_m2": 33 }
}
```

- 모든 필드는 선택. `is_main: true`로 바꾸면 기존 기준 자리는 해제된다.
- `listing`은 사용자가 입력한 값 그대로 저장한다 (서비스가 추정하지 않음).

### `DELETE /api/stores/{store_id}/sites/{site_id}`

응답 `204`

### `POST /api/stores/{store_id}/sites/compare` — 매물 비교

요청

```json
{ "site_ids": ["st-01", "st-02"] }
```

- 생략하면 `listing`이 입력된 모든 자리를 비교한다.

응답

```json
{
  "sites": [
    {
      "site_id": "st-01",
      "label": "A",
      "listing_result": {
        "initial_cost_krw": 43000000,
        "monthly_fixed_krw": 2700000,
        "rent_per_m2_krw": 75757,
        "vs_area_average": { "available": false },
        "runway_months": { "value": 14.8, "basis": "준비 자금 40,000,000원 기준", "available": true },
        "site_questions": [
          "권리금 10,000,000원에 포함된 시설·집기 목록을 받을 수 있나요?",
          "전 임차인이 이 자리에서 장사를 접은 이유가 무엇인가요?"
        ]
      }
    }
  ],
  "summary": "A 자리는 반경 300m에 카페가 14곳으로 B보다 경쟁이 심하지만, 초기 비용은 B보다 낮습니다. …",
  "summary_by": "ai"
}
```

- `initial_cost_krw`, `monthly_fixed_krw`, `rent_per_m2_krw`, `runway_months`는 **계산 도구**가 입력값으로 계산한다. AI는 숫자를 만들지 않고 요약과 현장 질문만 생성한다.
- `runway_months`는 `funds_krw` 답변이 있을 때만 계산한다. 없으면 `available: false`.
- `vs_area_average`는 지역 평균 임대료 원천이 [예시]인 동안 `{"is_example": true, ...}` 또는 `available: false`로 내려간다.

---

## 10. 상권 분석의 메뉴·가격대 [예시]

### `GET /api/stores/{store_id}/market`

```json
{
  "is_example": true,
  "example_notice": "예시 데이터입니다. 실제 조회 결과가 아닙니다.",
  "radius_m": 300,
  "competitors": [ { "name": "예시카페A", "distance_m": 120, "signature": "아메리카노", "price_americano": 4500 } ],
  "price_distribution": { "americano": { "min": 2000, "median": 4500, "max": 6500 } },
  "area_average_rent": { "is_example": true, "per_m2_krw": 72000, "as_of": "2026-Q3" },
  "gaps": ["디저트 전문점 없음", "저가 브랜드 3곳 밀집"]
}
```

- 동종 업소 **목록과 거리**는 `/map`의 `nearby_shops`로 실제 조회가 가능하다. 이 엔드포인트의 메뉴·가격과 지역 평균 임대료만 예시로 남는다.
- 민간 상권 서비스(예: 오픈업)의 데이터는 약관상 쓰지 않는다.

---

## 11. 정책 알림 [시간되면]

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
- `filter`(`all | eligible | closing_soon`)는 백엔드가 저장된 결과에서 거른다.

---

## 12. 알림 [핵심: 조회 / 시간되면: 재조회]

### `GET /api/stores/{store_id}/alerts`

```json
{
  "items": [
    { "alert_id": "al-01", "type": "grant_new", "title": "새 지원사업 공고", "body": "…", "is_example": false, "read": false, "created_at": "..." },
    { "alert_id": "al-02", "type": "data_changed", "title": "주변 카페 1곳 개업", "diff": { "before": 13, "after": 14 }, "is_example": true, "read": false, "created_at": "..." }
  ]
}
```

- `type`: `grant_new | grant_deadline | data_changed | checklist`
- 개업 6개월 후 알림 등 시간이 지나야 발생하는 알림은 `is_example: true`로 보여준다.

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

### `POST /api/demo` — 예시로 해보기 (이서연 씨 사례)

응답 `201`

```json
{ "store_id": "demo-…", "run_id": "…", "cached": true }
```

- 미리 저장해 둔 결과를 복사해 새 `store_id`로 만든다 (`is_demo: true`). 외부 API가 전부 실패해도 동작해야 한다.
- 프론트는 `/stores/{store_id}?demo=1`로 이동하고, SSE는 저장된 이벤트를 짧은 간격으로 재생한다.

### `GET /api/health`

```json
{ "status": "ok", "mock": false, "db": "ok", "version": "0.1.0" }
```

---

## 14. 프론트 화면과 API 매핑

| 화면 (경로) | 호출 API | 범위 |
| --- | --- | --- |
| 시작 `/` | `GET /health`, `POST /demo` | 핵심 |
| 가게 등록 `/new` | `POST /stores`, `POST /stores/{id}/answers` | 핵심 |
| 조사 중 `/stores/{id}/run/{runId}` | `POST /stores/{id}/analyze`, `GET /runs/{runId}/stream`, `GET /runs/{runId}` | 핵심 |
| 내 가게 `/stores/{id}` | `GET /stores/{id}/dashboard`, `PATCH /stores/{id}`, `GET /alerts`, `PATCH /alerts/{alertId}` | 핵심 |
| 점검 리포트 `/stores/{id}/report` | `GET /report`, `POST /report/items/{itemId}/choose` | 핵심 |
| 개업 체크리스트 `/stores/{id}/checklist` | `GET /checklist`, `PATCH /checklist/{itemId}` | 핵심 |
| 내 가게 챗봇 (모든 화면의 패널) | `POST /chat`, 제안 확인 시 `PATCH /stores/{id}` | 시간되면 |
| 입지·상권 지도 `/stores/{id}/map` | `GET /map`, `POST /sites`, `PATCH /sites/{siteId}`, `DELETE /sites/{siteId}`, `POST /sites/compare`, `GET /market` | 시간되면 (`/market`은 예시) |
| 정책 알림 `/stores/{id}/grants` | `GET /grants` | 시간되면 |
| 다시 조회 (내 가게의 버튼) | `POST /refresh` | 시간되면 |
