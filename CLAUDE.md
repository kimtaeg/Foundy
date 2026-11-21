# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

- 한국어로 답변한다.
- "확인해줘", "봐줘", "뭐가 문제야" 같은 표현은 분석만 요청하는 것으로 간주하고 코드를 수정하지 않는다.
- "수정해줘", "고쳐줘", "반영해줘", "만들어줘", "추가해줘", "삭제해줘", "진행해" 같은 명시적 요청이 있으면 별도 승인을 기다리지 않고 바로 수정한다. 큰 변경(DB 스키마, 공용 JSON 형식, 여러 모듈에 걸친 구조 변경)은 먼저 설계 요지를 짧게 알리고 진행한다.
- 판단이 갈리는 선택(예: 구현 방식 A/B)은 트레이드오프를 비교해 추천안을 먼저 말하고, 사용자가 고르면 진행한다.

## Workflow

작업은 아래 순서로 진행한다.

1. **분석**: 관련 코드·설정·`docs/mvp.md`를 먼저 파악한다.
2. **제안**: 원인과 해결 방향을 설명한다. 대안이 있으면 트레이드오프를 비교해 추천안을 제시한다.
3. **작업**: 수정 요청이 있으면 구현하고, **실제 호출로** 입력과 출력을 확인한다 (Testing Policy 참고).
4. **보고**: 무엇을 바꿨고 무엇을 검증했는지, 검증하지 못한 부분이 무엇인지 사실대로 말한다.

그 외 규칙:

- **커밋·푸시·PR·머지는 사용자가 요청했을 때만 한다.** 요청하면 Claude가 진행한다. 요청이 없으면 변경만 남기고 추천 커밋 메시지를 알려 준다.
- 커밋 메시지는 `타입: 한국어 요약` 형식이다. 서로 성격이 다른 변경(fix / feat / test / docs)은 커밋을 나눈다.
- PR을 생성할 때는 변경 타입에 맞는 라벨(`bug`/`enhancement`/`refactor`/`test`/`documentation`/`chore`)을 지정하고, 담당자(assignee)는 `gh pr create --assignee @me`로 현재 작업 중인 사람(gh CLI 인증 계정)을 지정한다. PR 대상 브랜치는 `dev`다.
- **DB 마이그레이션(`alembic upgrade`)은 공용 Railway DB를 바꾸므로 적용 전에 사용자에게 확인한다.** 강제 푸시(`--force*`)는 쓰지 않는다. `dev`와 충돌하면 `dev`를 머지해 푼다.
- 예선 마감은 **2026-11-23(월) 17:00**이다. `docs/mvp.md`의 Must 항목을 우선하고, 상권 분석·다른 업종처럼 아직 만들지 않은 큰 기능은 요청이 범위를 넘으면 먼저 알린다.
- 판정값 4가지(`위반 소지 높음`·`확인 권장`·`판단 불가`·`문제 없음`)는 바꾸지 않는다.

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
pytest                           # 전체 테스트 (DB·LLM 호출이 있어 수 분 걸린다)
pytest tests/scenarios           # 데모 시나리오 S1~S4
RUN_LLM_TESTS=1 pytest tests/scenarios -m llm   # 실제 LLM으로 시나리오 확인
alembic upgrade head             # DB 마이그레이션 (적용 전 확인, 배포 시 Railway preDeploy가 자동 실행)
python -m law_rag.ingest         # 법령 수집·저장·임베딩 (--reembed: 임베딩만 다시)
python -m law_rag.forms          # 법령 공식 서식(별지 서식) 파일 링크 수집
USE_MOCK=true uvicorn main:app --reload   # 화면 시연용: 외부 API 대신 mocks/ 응답 사용 (테스트·검증에는 쓰지 않는다)
```

외부 API 키가 없거나 승인 전이면 실제 호출 테스트가 실패할 수 있다. API 키·승인·IP 등록 문제로 인한 실패와 코드 문제로 인한 실패를 명확히 구분해서 보고한다.

### Testing Policy

- **테스트와 동작 검증은 목 데이터로 돌리지 않고 실제로만 돌린다.** `USE_MOCK=true`, `mocks/` 응답, `tests/fakes.py` 같은 가짜 조회 도구·가짜 LLM·모의 조문으로 통과한 결과는 검증으로 인정하지 않는다.
- 실제로 돌린다는 것은 실제 LLM API, 실제 법령 DB(RAG 검색)·법령 API, 실제 건축물대장·상표 API를 호출한다는 뜻이다. 입력과 출력(검색된 조문, 판정, 인용)을 직접 확인해 보고한다.
- 키·승인·IP 등록·네트워크 때문에 실제 호출이 안 되면 모의로 대체해 통과시키지 말고, 못 돌렸다고 원인과 함께 보고한다.
- 새 테스트는 실제 호출을 쓰도록 만든다 (예: `tests/test_building_area_real.py`, `tests/test_obligation_tasks.py`). 키·DB가 없으면 `skip`하고, 모의로 대신 통과시키지 않는다. 기존에 가짜 도구(`tests/fakes.py`)로 쓰던 테스트는 손댈 때 실제 호출로 옮긴다.
- 순수 규칙 코드(규칙 엔진·날짜 계산·청킹 등 외부 호출이 없는 함수)는 가짜 없이 그대로 테스트해도 된다.
- 모의 응답(`USE_MOCK`, `mocks/`)은 "예시로 해보기" 같은 화면 시연용 런타임 기능으로만 남긴다.
- 테스트에 쓰는 LLM 키·모델은 환경변수로만 넘기고 파일에 쓰지 않는다. 판정 모델은 `gpt-4.1`을 쓴다 (같은 입력에서 `gpt-4.1-mini`보다 정확했고, Gemini flash-lite는 근거 조문 키를 원문 그대로 옮기지 못해 `high`가 `low`로 내려가는 일이 있었다).

## Architecture Overview

### Service

카페·음식점을 여는 청년을 위한 **창업 전 사전 점검 에이전트**.
사용자가 업종, 주류 판매 여부, 주소(층), 영업장 면적, 직원·배달 여부, 가게 이름, 개업 예정일을 입력하면 에이전트가 건축물대장·법령(RAG)·상표를 조회해 "계약 전 꼭 확인 / 개업 전 할 일 / 운영 중 주의" 리포트와, 법적 의무를 작업으로 바꾼 **의무 중심 개업 체크리스트**를 만든다.

### Repository Structure

```text
Foundy/
├── docs/
│   ├── mvp.md                # MVP 명세서 (범위의 기준)
│   ├── API 명세서.md · DB 명세서.md · 기능 명세서.md
│   ├── report-schema.json    # 리포트 JSON 형식 (프론트·백엔드 공용 약속)
│   ├── checklist-schema.json # 체크리스트 응답 형식 (항목 정의는 report-schema.json 의 checklist_item)
│   ├── examples/             # 스키마를 따르는 예시 JSON (프론트 개발용)
│   ├── 법령_RAG_구현.md · AI_모듈_연동_가이드.md · 아키텍처_인프라.md · 시연_전_점검.md
├── frontend/                 # Next.js + TypeScript + Tailwind
│   └── src/                  # app, components, hooks, lib/api, providers, types, data
└── backend/                  # FastAPI
    ├── main.py               # FastAPI 앱 (CORS, 라우터 등록, 시작 시 중단된 runs 정리)
    ├── config.py             # 환경변수 설정 (pydantic-settings)
    ├── railway.json          # Railway 배포 설정 (preDeploy: alembic upgrade head)
    ├── api/                  # 라우터 (health, demo, auth, me, stores, checklist, documents, alerts, runs[분석·SSE], laws[내부 갱신])
    ├── services/             # 분석 저장, 유효 값, 카드 상태 변경, 응답 조립(serializers), 서류함(documents), 가게 등록·수정, 로그인
    ├── calc/                 # 코드가 하는 계산: 날짜, 선택지 효과, 카드↔체크리스트 연결, 다음 할 일, 법령→체크리스트 작업(obligation_tasks)
    ├── db/                   # 엔진·세션, ORM 모델, 예시 계정 시드, migrations/ (0001~0006)
    ├── agent/                # 분석 루프(loop), 판정(judge), 해결 방안(advise), 챗봇, 가드레일, 프롬프트, LLM 어댑터, 비용 기록
    ├── law_rag/              # 법령 수집·파싱·청킹·임베딩(pgvector)·검색, 변경 감지(changes)
    ├── tools/                # 외부 API 조회 (address, providers[건축물대장·상표·법령·지원사업], analysis[캐시·모의 대체])
    ├── rules/                # 규칙 묶음(packs/cafe_restaurant.yaml), 규칙 엔진, 적용 조건(applicability), 건물 용도 코드표(data/)
    ├── mocks/                # 화면 시연용 모의 응답 JSON
    ├── scripts/              # 데모·API 점검 스크립트
    └── tests/                # 단위·실제 호출 테스트, scenarios/ (데모 시나리오 입력과 기대 결과)
```

### Report Schema Convention

- `docs/report-schema.json`(+ `checklist-schema.json`)이 프론트와 백엔드 사이의 약속이다.
- 형식을 바꾸면 **같은 PR에서** 스키마, `docs/examples`, 백엔드 생성·직렬화 코드, API·DB 명세서를 함께 수정하고, 프론트 표시 코드는 후속이면 PR에 명시한다.
- 새 응답 필드는 선택(optional)으로 추가해 기존 프론트가 깨지지 않게 한다.
- 프론트는 백엔드가 없어도 스키마를 따르는 모의 리포트 JSON으로 화면을 개발할 수 있어야 한다.

### Agent Flow

분석은 순서가 고정된 파이프라인이다 (`agent/loop.py`의 `run_analysis`). AI가 도구를 마음대로 고르지 않는다.

1. 입력을 받으면 `rules/`에서 업종 규칙 묶음을 불러오고, `ask`에 따라 빠진 정보만 되묻는다.
2. 규칙 엔진이 가게 정보로 법령 적용 여부(`applies`·`not_applicable`·`needs_check`)를 판정한다 (`rules/applicability.py`, 결과는 `legal_obligations`에 저장).
3. 조회: 건축물대장 → 상표 → 법령(저장된 법령 RAG 검색). 진행 상황을 SSE로 스트리밍한다 (`GET /api/runs/{id}/stream`, 폴링은 `GET /api/runs/{id}`).
4. 규칙표 대조 → AI 판정(건물 용도·위반건축물·영업신고 서류·상표·광고 문구) → 해결 방안(결과 카드) 순으로 만든다.
5. **체크리스트**: 기본 일정(템플릿)에 규칙 엔진이 적용·확인 필요로 판정한 법적 의무와 조건부 작업을 합친다 (`calc/obligation_tasks.py`).
6. 점검 1회의 토큰·비용을 기록한다 (`cost_logs`). 정책 알림(지원사업)은 선택 단계다.

### Judgment Rules

- **업종 결정(주류 여부 → 휴게/일반음식점)은 규칙 묶음이 한다.** 법에 명시된 구분이라 LLM에게 맡기지 않고, 이 값은 AI 판정의 입력이 된다.
- **건물 용도 적합 여부·위반건축물·영업신고 서류·상표 유사는 AI가 조회한 데이터를 읽고 판정한다.** 코드는 AI가 인용한 용도·조문 문장·상표 번호가 원문에 실제로 있는지 검증하고, 검증에 실패하면 `판단 불가`(또는 `high`는 `low`)로 낮춘다. 규칙표(업종별 허용 건물 용도)는 AI 판정을 대조하는 안전장치이고, AI가 실패하면 규칙표·안내 카드로 대체한다(`ai_fallback`). `high`가 될 수 있는 AI 판정은 건물 용도·위반건축물뿐이고, 근거 검증과 규칙표 대조를 통과해야 한다.
- **면적 기준은 가게 면적만으로 단정하지 않는다.** 제1종 근린생활시설의 휴게음식점은 "같은 건축물에서 해당 용도로 쓰는 바닥면적 합계 300㎡ 미만"일 때만 가능해서, 면적이 300㎡ 이상이거나 입력이 없으면 `ok`가 아니라 `low`(확인 권장)다 (`rules/packs`의 `building_use.area_limits`).
- **코드가 AI 판정을 바꿨으면(낮춤·판단 불가) AI의 단정적인 제목을 쓰지 않고 규칙의 제목 템플릿(`titles`)을 쓴다.**
- **LLM은 규칙으로 못 하는 판단만 한다.** 조문을 사용자 상황에 맞게 설명하기, 메뉴·광고 문구 위반 소지, 상표 유사성, 되물을 질문 선택. 날짜·금액은 코드가 계산한다.
- 판정은 4가지만 쓴다: `high`(위반 소지 높음) / `low`(위반 소지 낮음·확인 권장) / `unknown`(판단 불가) / `ok`(문제 없음, 접어서 표시)
- 모든 리포트 항목에는 근거(데이터 원값 또는 법령 조문 원문 + law.go.kr 링크)가 있어야 한다. **근거가 없으면 `판단 불가`로 두고 판단을 지어내지 않는다.** 실제 모드에서는 모의 조문을 근거로 쓰지 않는다.
- **법령 조문은 DB에 저장해 RAG로 검색한다** (`laws`·`law_articles`·`law_embeddings`, pgvector). 조문은 원문 그대로 조각내 저장하고 AI가 인용한 문장은 원문에서 다시 찾아 검증한다. 별표처럼 긴 표는 조각 앞에 `[소속] 4. 제2종 근린생활시설` 같은 상위 제목을 붙인다. 법령이 개정되면 변경을 감지해 영향받는 가게에 알림을 만들고 관련 체크리스트 작업에 재검토를 표시한다 (`law_rag/changes.py`).
- **문제 항목은 결과 카드로 만든다**: 쉬운 말 결론 → 안 하면 생기는 일 → 선택지 → 추천 → 대신 만든 결과물(문의 문자·특약 문구·서류 초안) → 사용자가 할 일 1개. "~를 확인하세요"로 끝내지 않는다.
- 선택지·초안의 종류는 규칙 묶음(`remedies`, `drafts`) 범위 안에서만 만든다(안내형 선택지는 AI가 최대 2개 더 제안할 수 있다). 기간·금액은 근거(규칙·계산·데이터)가 있을 때만 숫자로 쓰고, 없으면 "확인 필요"로 둔다. 초안은 조회한 데이터를 문장에 채우는 것으로 제한하고 모르는 칸은 `[확인 필요]`로 비운다.

### Checklist Rules

- 체크리스트 작업은 세 가지 유형이다: `legal_obligation`(필수) / `conditional`(조건부, 적용 판단 이유를 보여준다) / `preparation`(권장). 생성 출처는 `source_type`: `template`(기본 일정) · `rule_engine`(조건 규칙) · `legal_analysis`(점검 카드가 검증해 인용한 조문이 있는 법령 분석) · `inspection` · `grant`.
- **RAG 검색 결과를 그대로 작업으로 만들지 않는다.** 규칙 엔진이 적용(`applies`)·확인 필요(`needs_check`)로 판정한 규칙만 `applicability_rules[].task`로 작업이 된다. 적용 안 함이면 만들지 않는다.
- **`due_date`는 권장 준비일(개업일 + `offset_days`)이다.** 법령이 개업 전 기한을 정한 경우만 `statutory_deadline`(개업 전날)과 `statutory_basis`를 따로 채우고, 조문에 근거가 없으면 비워 둔다. 권장일을 법정 기한처럼 표시하지 않는다.
- 법령 개정이나 재분석으로 더는 적용되지 않는 작업이라도 사용자가 완료한 기록은 지우지 않고 `review_needed`로 표시한다. 미완료 작업만 삭제한다.
- 새 작업은 해당 점검 카드(`check_id`)와 연결되어 카드를 완료하면 자동 체크된다. 기본 항목의 연결은 규칙 묶음 `report_links`가 정한다.

### Documents Rules (서류함)

- 서류함은 체크리스트의 하위 화면이 아니라 **서류마다 독립된 상태**를 가진다 (`document_requirements`). 진행률은 서류 상태(`obtained`·`submitted`)로 세고 `not_applicable`은 분모에서 뺀다. **발급·취득 완료와 제출 완료는 구분한다.**
- 서류는 세 곳에서 같은 구조로 합쳐진다: 규칙 묶음 `documents`(기본 템플릿), 법령 규칙 `applicability_rules[].documents`(규칙 엔진 판정), 점검 카드가 검증한 조문이 붙은 법령 분석. 법령에 의무가 있어도 별도 서류가 없으면 서류를 만들지 않고 체크리스트 작업으로만 둔다.
- 서류 이름·받는 곳·안내 문장은 조문이나 공식 안내로 확인된 것만 규칙 묶음에 적는다 (근거 조문을 `guide`에 남긴다). 링크는 규칙 묶음 `sites`의 검증된 첫 화면만 쓰고, **공식 서식 파일 링크는 법제처 API로 수집한 값(`law_forms`)만 쓴다. 규칙 묶음이나 코드에 URL을 적지 않는다.**
- 법령에 첨부된 서식은 `python -m law_rag.forms`(법령 갱신 때 같이 실행)로 수집하고, 개정되면 이전 행을 남기고 그 서식을 쓰는 서류에 재검토를 표시한다.
- YAML에서 `no`·`yes`·`on`·`off`는 불리언으로 읽힌다. 키 이름으로 쓰지 않는다 (`form_no`).
- 서류함에는 파일 올리기와 전화번호를 두지 않는다 (서류 상태와 이력만 관리한다).

### Tool Convention

- 외부 API 조회는 `tools/`에 둔다 (`address.py`, `providers.py`, `analysis.py`). 저장된 법령 검색은 `law_rag/service.py`가 맡는다.
- 화면 시연용 모의 응답은 `mocks/`에 둔다. `USE_MOCK=true`이거나 API 호출이 실패하면 모의 응답으로 대체하고, **"예시로 해보기"는 어떤 API가 실패해도 끝까지 돌아가야 한다.** 단 실제 모드에서는 모의 조문을 판정 근거로 쓰지 않는다.
- 같은 주소·같은 조회 결과는 `api_cache` 테이블로 재사용한다 (`tools/analysis.py`).

### Adding a New Business Type

업종 추가는 코드 수정이 아니라 `rules/packs/`에 규칙 묶음 YAML을 하나 추가하는 작업이어야 한다. 에이전트·도구 코드에 특정 업종 이름을 하드코딩하지 않는다. (현재 면적 제한·건물 용도 표·법령 규칙·체크리스트 작업이 모두 YAML에 있다.)

### External APIs

| API | 용도 | 위치 |
|-----|------|------|
| 도로명주소·카카오 로컬 | 주소 → 법정동코드·번·지 | `tools/address.py`, `tools/providers.py` |
| 건축물대장 (국토부 건축HUB) | 건물·층별·호별 용도와 면적 | `tools/providers.py` |
| 국가법령정보 (법제처) | 법령 수집·조문 링크·공식 서식 링크 (OC 등록 IP 제한 있음) | `law_rag/collector.py`, `law_rag/forms.py` |
| KIPRIS Plus (특허청) | 유사 등록 상표 검색 | `tools/providers.py` |
| LLM API | 판정·해결 방안·챗봇·되묻기 (`LLM_PROVIDER`: openai \| gemini) | `agent/llm.py` |
| 임베딩 API | 법령 조각 임베딩 (기본 OpenAI `text-embedding-3-large`, 768차원) | `law_rag/embedder.py` |

### Environment Variables

- 실제 값은 각자 `.env`에만 두고 **절대 커밋하지 않는다.** 새 환경변수를 쓰면 `.env.example`에 이름만 추가한다. 전체 목록은 `backend/.env.example`이 기준이다.
- backend 주요 값: `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL_FAST`, `LLM_MODEL_MAIN`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, `JUSO_API_KEY`, `BUILDING_API_KEY`, `LAW_OC`, `KIPRIS_API_KEY`, `KAKAO_REST_KEY`, `DATA_GO_KR_KEY`, `USE_MOCK`, `LAW_RAG_ENABLED`, `FRONTEND_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, `INTERNAL_TOKEN`, 소셜 로그인(`KAKAO/GOOGLE/NAVER_CLIENT_ID·SECRET`, `OAUTH_REDIRECT_URIS`)
- frontend: `NEXT_PUBLIC_API_BASE_URL`
- 판정 모델은 OpenAI를 쓴다: `LLM_PROVIDER=openai`, `LLM_MODEL_MAIN=gpt-4.1` (배포는 Railway 서비스 변수에 설정).
- API 키가 커밋되거나 채팅·로그에 노출된 것을 발견하면 즉시 알리고, 해당 키는 재발급해야 한다고 안내한다.

## Branch & Commit Convention

브랜치명 (이슈가 있으면 번호를 넣는다):
```text
feat/#이슈번호-기능명
fix/#이슈번호-버그명
docs/#이슈번호-문서명
```
이슈 없이 작업하는 경우 `fix/짧은-설명`처럼 `타입/설명` 형식을 쓴다.

커밋 타입: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

- `main`은 항상 배포 가능한 상태로 유지한다. `main`에 머지되면 frontend는 Vercel, backend는 Railway로 자동 배포된다. DB는 Railway PostgreSQL이다.
- `dev`가 통합 브랜치이고 `main`·`dev`는 보호 브랜치다 (직접 푸시 금지, PR로만). 기능 브랜치는 `dev`에서 만들고 `dev`로 PR을 올린다.
- 머지는 머지 커밋(`gh pr merge --merge`)을 쓴다.
- PR은 하루 안에 머지할 수 있는 크기로 나눈다.

## PR Rules

- 원칙은 리뷰어 1명 승인 후 머지다. 사용자가 머지를 직접 지시하면 그 PR은 Claude가 머지할 수 있다 (머지는 사용자가 요청한 PR에만 한다).
- 머지 전에 `dev`와 충돌이 없는지, 관련 테스트가 실제 호출 기준으로 통과하는지 확인하고 PR 본문에 검증 결과를 적는다.
- `docs/report-schema.json`·`checklist-schema.json`을 바꾸는 PR은 프론트 담당과 백엔드 담당이 모두 확인한다.
- DB 스키마를 바꾸는 PR은 마이그레이션 번호와 적용 여부(공용 DB에 적용했는지)를 본문에 적는다.

## Demo Scenarios

머지 전, 리포트 생성 로직을 건드렸다면 아래 시나리오가 기대대로 나오는지 **실제 호출로** 확인한다 (`RUN_LLM_TESTS=1 pytest tests/scenarios -m llm`, 또는 실제 도구·LLM으로 `run_analysis`를 돌려 입력·출력 확인).

| # | 입력 | 기대 결과 |
|---|------|-----------|
| S1 | 휴게음식점 용도 층 + 주류 판매 | `위반 소지 높음`: 일반음식점 필요, 건물 용도 불일치. 결과 카드(선택지·추천·문의 문자·할 일 1개) 포함 |
| S2 | 등록 상표와 비슷한 가게 이름 | `확인 권장`: 유사 상표 목록 |
| S3 | 메뉴 설명에 효능 표현 | `확인 권장`: 광고 문구 위반 소지 |
| S4 | 문제없는 입력 | 위반 항목 없이 할 일과 일정표만 표시 |

면적 경계 입력도 함께 확인한다: 제1종 건물의 카페는 40㎡ `ok`, 300㎡ 이상·면적 미입력 `low`, 처음 입력(일반음식점·제1종 층)은 `high`.
