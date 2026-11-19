# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

- 한국어로 답변한다.
- "확인해줘", "봐줘", "뭐가 문제야" 같은 표현은 분석만 요청하는 것으로 간주하고 코드를 수정하지 않는다.
- "수정해줘", "고쳐줘", "반영해줘", "만들어줘", "추가해줘", "삭제해줘" 같은 명시적 요청이 있을 때만 파일을 편집한다.
- 수정 전에 어떤 파일을 왜 건드릴지 먼저 설명하고, 명시적 승인을 기다린다.

## Workflow

작업은 항상 아래 순서로 진행한다.

1. **분석**: 관련 코드·설정·`docs/mvp.md`를 먼저 파악한다.
2. **제안**: 원인과 해결 방향을 설명한다.
3. **비교**: 대안이 있으면 트레이드오프를 비교해 추천안을 제시한다.
4. **작업**: 사용자 승인 후에만 실제로 파일을 수정한다.

그 외 규칙:

- 커밋은 항상 사용자가 직접 한다. Claude는 스스로 커밋하지 않는다.
- 작업이 끝나면 커밋 메시지를 추천한다 (커밋 자체는 하지 않는다).
- PR을 생성할 때는 변경 타입에 맞는 라벨(`bug`/`enhancement`/`refactor`/`test`/`documentation`/`chore`)을 지정하고, 담당자(assignee)는 `gh pr create --assignee @me`로 현재 작업 중인 사람(gh CLI 인증 계정)을 지정한다.
- 예선 마감은 **2026-11-23(월) 17:00**이다. `docs/mvp.md`의 Must 항목이 끝나기 전에는 로그인, 상권 분석, 다른 업종 같은 범위 밖 기능을 만들지 않는다. 요청이 범위를 넘으면 먼저 알려준다.

## Build & Test Commands

```bash
# frontend (Next.js)
cd frontend
npm install
npm run dev                      # 개발 서버 (http://localhost:3000)
npm run build                    # 빌드
npm run lint                     # 린트

# backend (FastAPI)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload        # 개발 서버 (http://localhost:8000)
pytest                           # 전체 테스트
pytest tests/scenarios           # 데모 시나리오 S1~S4
USE_MOCK=true uvicorn main:app --reload   # 외부 API 대신 mocks/ 응답 사용
```

외부 API 키가 없거나 승인 전이면 실제 호출 테스트가 실패할 수 있다. API 키·승인·IP 등록 문제로 인한 실패와 코드 문제로 인한 실패를 명확히 구분해서 보고한다.

## Architecture Overview

### Service

카페·음식점을 여는 청년을 위한 **창업 전 사전 점검 에이전트**.
사용자가 업종, 주류 판매 여부, 주소(층), 가게 이름, 개업 예정일을 입력하면 에이전트가 건축물대장·법령·상표를 조회해 "계약 전 꼭 확인 / 개업 전 할 일 / 운영 중 주의" 리포트와 개업 역산 일정표를 만든다.

### Repository Structure

```text
cafe-precheck/
├── docs/
│   ├── mvp.md                # MVP 명세서 (범위의 기준)
│   └── report-schema.json    # 리포트 JSON 형식 (프론트·백엔드 공용 약속)
├── frontend/                 # Next.js + TypeScript + Tailwind
│   ├── app/                  # 시작 / 입력·되묻기 / 조사 중 / 리포트 화면
│   ├── components/
│   └── lib/api.ts            # 백엔드 호출, SSE 수신
└── backend/                  # FastAPI
    ├── main.py               # 엔드포인트 (/check, /check/stream)
    ├── agent/                # 에이전트 루프, 프롬프트, 리포트 조립, 비용 기록
    ├── tools/                # 외부 API 도구 (address, building, law, trademark, cache)
    ├── rules/                # 업종별 점검 규칙 묶음 (cafe_restaurant.yaml)
    ├── mocks/                # 도구별 모의 응답 JSON
    └── tests/scenarios/      # 데모 시나리오 입력과 기대 결과
```

### Report Schema Convention

- `docs/report-schema.json`이 프론트와 백엔드 사이의 약속이다.
- 형식을 바꾸면 **같은 PR에서** 스키마, 백엔드 생성 코드, 프론트 표시 코드를 함께 수정한다.
- 프론트는 백엔드가 없어도 스키마를 따르는 모의 리포트 JSON으로 화면을 개발할 수 있어야 한다.

### Agent Flow

1. 입력을 받으면 `rules/`에서 업종에 맞는 규칙 묶음을 불러온다.
2. 규칙 묶음의 `ask`에 따라 빠진 정보만 사용자에게 되묻는다.
3. 에이전트가 도구를 호출한다: `resolve_address` → `get_building_info` → `get_law_article` → `search_trademark`
4. 각 단계 진행 상황을 SSE로 프론트에 스트리밍한다.
5. 규칙 판정 결과와 LLM 판단을 합쳐 리포트를 만들고, 점검 1회의 토큰·비용을 기록한다.

### Judgment Rules

- **규칙으로 판단할 수 있는 것은 코드·YAML이 판단한다.** 업종 결정(주류 여부 → 휴게/일반음식점), 건물 용도 적합 여부는 LLM에게 맡기지 않는다.
- **LLM은 규칙으로 못 하는 판단만 한다.** 조문을 사용자 상황에 맞게 설명하기, 메뉴·광고 문구 위반 소지, 상표 유사성, 되물을 질문 선택.
- 판정은 3단계만 쓴다: `위반 소지 높음` / `위반 소지 낮음·확인 권장` / `판단 불가`
- 모든 리포트 항목에는 근거(데이터 원값 또는 법령 조문 원문 + law.go.kr 링크)가 있어야 한다. **근거가 없으면 `판단 불가`로 두고 판단을 지어내지 않는다.**
- 법령 조문은 저장해 두지 않고 매번 법령 API(또는 캐시)에서 가져온다.
- **문제 항목은 결과 카드로 만든다**: 쉬운 말 결론 → 안 하면 생기는 일 → 선택지 → 추천 → 대신 만든 결과물(문의 문자·특약 문구·서류 초안) → 사용자가 할 일 1개. "~를 확인하세요"로 끝내지 않는다.
- 선택지·초안의 종류는 규칙 묶음(`remedies`, `drafts`) 범위 안에서만 만든다. 기간·금액은 근거(규칙·계산·데이터)가 있을 때만 숫자로 쓰고, 없으면 "확인 필요"로 둔다. 초안은 조회한 데이터를 문장에 채우는 것으로 제한하고 모르는 칸은 `[확인 필요]`로 비운다.

### Tool Convention

- 모든 외부 API 도구는 `tools/`에 하나씩 두고, 같은 이름의 모의 응답을 `mocks/`에 둔다.
- `USE_MOCK=true`이거나 API 호출이 실패하면 모의 응답으로 대체한다. **"예시로 해보기"는 어떤 API가 실패해도 끝까지 돌아가야 한다.**
- 같은 주소·같은 조문 조회 결과는 `tools/cache.py`로 재사용한다.

### Adding a New Business Type

업종 추가는 코드 수정이 아니라 `rules/`에 규칙 묶음 YAML을 하나 추가하는 작업이어야 한다. 에이전트·도구 코드에 특정 업종 이름을 하드코딩하지 않는다.

### External APIs

| API | 용도 | 도구 |
|-----|------|------|
| 도로명주소 (행정안전부) | 주소 → 법정동코드·번·지 | `tools/address.py` |
| 건축물대장 (국토부 건축HUB) | 건물·층별 용도와 면적 | `tools/building.py` |
| 국가법령정보 (법제처) | 조문 원문·링크 (OC 등록 IP 제한 있음) | `tools/law.py` |
| KIPRIS Plus (특허청) | 유사 등록 상표 검색 | `tools/trademark.py` |
| LLM API | 에이전트 tool use | `agent/` |

### Environment Variables

- 실제 값은 각자 `.env`에만 두고 **절대 커밋하지 않는다.** 새 환경변수를 쓰면 `.env.example`에 이름만 추가한다.
- backend: `LLM_API_KEY`, `LLM_MODEL`, `JUSO_API_KEY`, `BUILDING_API_KEY`, `LAW_OC`, `KIPRIS_API_KEY`, `USE_MOCK`, `FRONTEND_ORIGIN`, `DATABASE_URL`
- frontend: `NEXT_PUBLIC_API_BASE_URL`
- API 키가 커밋된 것을 발견하면 즉시 알리고, 해당 키는 재발급해야 한다고 안내한다.

## Branch & Commit Convention

브랜치명:
```text
feat/#이슈번호-기능명
fix/#이슈번호-버그명
```

커밋 타입: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

- `main`은 항상 배포 가능한 상태로 유지한다. `main`에 머지되면 frontend는 Vercel, backend는 Railway로 자동 배포된다. DB는 Railway PostgreSQL이다.
- PR은 하루 안에 머지할 수 있는 크기로 나눈다.

## PR Rules

- 리뷰어 1명 승인 후 머지 (셀프 머지 금지)
- `docs/report-schema.json`을 바꾸는 PR은 프론트 담당과 백엔드 담당이 모두 확인한다.

## Demo Scenarios

머지 전, 리포트 생성 로직을 건드렸다면 아래 시나리오가 기대대로 나오는지 확인한다.

| # | 입력 | 기대 결과 |
|---|------|-----------|
| S1 | 휴게음식점 용도 층 + 주류 판매 | `위반 소지 높음`: 일반음식점 필요, 건물 용도 불일치. 결과 카드(선택지·추천·문의 문자·할 일 1개) 포함 |
| S2 | 등록 상표와 비슷한 가게 이름 | `확인 권장`: 유사 상표 목록 |
| S3 | 메뉴 설명에 효능 표현 | `확인 권장`: 광고 문구 위반 소지 |
| S4 | 문제없는 입력 | 위반 항목 없이 할 일과 일정표만 표시 |
