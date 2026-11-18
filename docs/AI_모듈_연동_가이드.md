# AI 모듈 연동 가이드 (백엔드용)

> `backend/agent/`(AI 모듈)를 API에 연결하는 방법. 엔드포인트별로 어떤 함수를 부르고, 무엇을 저장하고, 무엇을 구현해 줘야 하는지 정리했다.
> 응답 형식은 `API 명세서.md`, 구조는 `아키텍처_인프라.md` 2-1을 함께 본다. 인터페이스 정의는 `backend/agent/ports.py`가 기준이다.

### 변경 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-11-18 | 최초 작성 (분석·챗봇·정책 알림·후보 자리 비교·예시로 해보기 연동) |

---

## 1. 한눈에 보기

AI 모듈은 **순수 파이썬 함수**다. 웹 프레임워크도 DB도 모른다. 백엔드는 (1) DB에서 읽은 값을 넘기고, (2) 결과를 DB에 저장하고, (3) 조회 도구·계산 도구를 꽂아 준다.

```text
백엔드(FastAPI)                         AI 모듈 (backend/agent/)
──────────────────                     ─────────────────────────────
POST /stores        ──────────────▶    select_questions(...)
POST /analyze       ──────────────▶    run_analysis(store, tools=, calc=, llm=, emit=)
POST /chat          ──────────────▶    chat(llm, ChatContext, message, history, focus)
GET  /grants        ──────────────▶    judge_grants(llm, store, tools.grants(store))
POST /sites/compare ──────────────▶    compare_sites(llm, store, sites)
POST /demo          ──────────────▶    (함수 호출 없음, mocks/demo/seoyeon.json 복사)
```

| 백엔드가 구현 | AI 모듈이 제공 |
| --- | --- |
| `tools`: 주소·건축물대장·상표·법령·지원사업 조회 (`building`, `trademark`, `law`, `grants`) | 규칙 묶음(`rules/`): 업종 구분, 건물 용도 판정, 체크리스트 기본 항목 |
| `calc`: 날짜 계산 (`checklist_dates`, `date_info`) | 판정·선택지·초안·챗봇·요약 (LLM 호출 포함) |
| DB 저장, SSE, 라우터, 캐시 | 근거 검증·가드레일, 비용 기록(`CostTracker`) |

> 숫자 조건 대조(`calc/match.py`)와 비용 계산(`calc/costs.py`)은 AI 모듈 쪽에서 이미 만들어 두었다. 같은 `calc/` 폴더에 `dates.py`를 추가하면 된다 (`__init__.py`는 만들지 않았다. 필요하면 추가해도 된다).

---

## 2. 사전 준비

### 2-1. 설치와 환경변수

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # 키는 .env에만 적고 커밋하지 않는다
```

| 변수 | 설명 |
| --- | --- |
| `LLM_PROVIDER` | `gemini`(기본) 또는 `openai` |
| `LLM_API_KEY` | 선택한 제공자의 API 키 |
| `LLM_MODEL_FAST` | 되묻기용 모델 (가볍고 빠른 것) |
| `LLM_MODEL_MAIN` | 판정·선택지·챗봇·요약용 모델 |
| `LLM_THINKING_LEVEL` | Gemini 생각 깊이 `minimal`/`low`/`medium`/`high` (비우면 모델 기본값, 낮을수록 빠름) |
| `LLM_PRICE_IN_USD_PER_1M`, `LLM_PRICE_OUT_USD_PER_1M`, `USD_KRW` | 비용 기록용 단가·환율 (비우면 비용 0으로 기록) |

### 2-2. 테스트로 먼저 확인

```bash
cd backend
pytest                                 # 단위·시나리오 테스트 (LLM 호출 없음)
python scripts/llm_smoke.py            # 키·모델 연결 확인 (실제 호출)
python scripts/demo_analysis.py        # 가짜 도구 + 실제 LLM으로 분석 한 번
RUN_LLM_TESTS=1 pytest tests/scenarios -m llm   # 시나리오 S1~S4를 실제 LLM으로
```

---

## 3. 백엔드가 구현할 인터페이스

정의는 `agent/ports.py`, 가짜 구현 예시는 `tests/fakes.py`(`FakeTools`, `FakeCalc`, `JsonTools`)에 있다.

### 3-1. `tools` — 모두 `ToolResult`를 돌려준다

```python
class ToolResult(BaseModel):
    ok: bool
    source: str                 # "건축물대장 층별개요" 같은 출처 이름 (화면 근거에 그대로 나온다)
    data: dict | None = None
    fetched_at: datetime | None = None
    from_cache: bool = False    # 캐시 사용 시 True → 화면에 표시
    from_mock: bool = False     # 모의 응답 사용 시 True → 화면에 표시
    error: str | None = None
```

- **조회에 실패하면 예외를 던지지 말고 `ok=False`로 돌려준다.** AI 모듈이 해당 항목을 `unknown`으로 두고 끝까지 진행한다 (예외가 나가도 `run_analysis`가 잡아서 같은 처리를 한다).
- 실패 순서는 아키텍처 5장대로 "실제 API → 캐시 → mock"이고, 어느 단계였는지 `from_cache`/`from_mock`에 남긴다.

| 메서드 | 인자 | `data` 필수 형태 |
| --- | --- | --- |
| `building(store)` | `StoreInput` | `{"floor_uses": ["제1종근린생활시설"], "violation": True \| False \| None}` |
| `trademark(name)` | 상호 | `{"similar": [{"reg_no", "name", "class_code", "status", "url"}]}` (없으면 빈 배열) |
| `law(check_id)` | 점검 항목 id (`building_use`, `alcohol_vs_type`) | `{"articles": [{"law_name", "article", "text", "url"}]}` |
| `grants(store)` | `StoreInput` | `{"grants": [{"grant_id", "title", "source", "url", "deadline": "YYYY-MM-DD" \| None, "text": "공고문 본문"}]}` |

**꼭 맞춰야 할 점**

- `building`의 `floor_uses`는 **이 가게가 있는 층**의 용도다 (`address_detail`의 층). 건물 전체 주용도가 아니다. `violation`은 응답에 위반건축물 표기가 없으면 **`None`**(아는 척하지 않기).
- `grants`의 `text`에는 공고문 본문(대상·조건·지원 내용·제출 서류)을 한 덩어리로 넣는다. 응답에 대상·지역·연령이 별도 필드로 있으면 본문 앞에 문장으로 붙여 준다. 6000자까지만 쓴다. AI가 인용하는 조건 문장이 이 `text` 안에 실제로 있어야 근거로 인정된다.
- `law`는 점검 항목마다 근거 조문을 돌려주는 자리다. 조문 번호는 규칙 담당이 확정하기 전까지 임시 값(건축법 시행령 별표 1, 식품위생법 시행령 제21조)이다.

### 3-2. `calc` — 날짜 계산

```python
class Calc(Protocol):
    def checklist_dates(self, opening_date: date, week: int) -> dict:
        # {"due_date": date, "dday": int, "group_label": "계약 전|개업 4주 전|개업 직전|개업 후"}
    def date_info(self, opening_date: date, due_date: date) -> dict:
        # 위와 같은 형태. 마감일처럼 날짜가 이미 정해진 항목용 (지원사업 마감)
    def site_cost_delta(self, base_listing: dict, other_listing: dict) -> dict | None:
        # {"initial_delta_krw": int, "monthly_delta_krw": int}  — calc/costs.py의 같은 이름 함수에 위임하면 된다
```

- **`group_label` 구간 기준을 정해 줘야 한다.** `dday`로 어떻게 나눌지(예: -56일 이하 "계약 전", -28일 이하 "개업 4주 전" …)는 아직 정해지지 않았다. `tests/fakes.py`의 `FakeCalc`는 임시 기준이다. 저장된 예시 결과(`seoyeon.json`)의 시기 구분도 이 임시 기준으로 만들어졌다.
- `dday`는 개업일 기준 일수이고 개업 전이면 음수다.

---

## 4. 엔드포인트별 연동

공통 준비:

```python
from agent.cost import CostTracker
from agent.llm import make_llm
from agent.ports import StoreInput, Site
from rules.engine import load_pack

pack = load_pack("cafe_restaurant")          # 서버 시작 시 한 번 (캐시됨)
cost = CostTracker()                          # 요청(또는 분석 1회)마다 새로 만든다
llm = make_llm(cost)                          # LLM_PROVIDER로 제공자 선택
```

### 4-1. `POST /api/stores` — 되묻기 질문

```python
from agent.questions import select_questions

store = StoreInput(store_id=..., name=..., address=..., address_detail=..., address_codes=..., opening_date=..., answers={})
questions = select_questions(llm, pack, store)      # -> list[Question]
```

- 주소를 코드·좌표로 바꾸는 일(`address_codes`)은 백엔드가 한다. 응답의 `questions`는 `[q.model_dump(mode="json") for q in questions]`.
- 필수 질문(`sells_alcohol`)은 AI가 빼도 항상 포함된다. LLM이 실패하면 남은 후보를 모두 묻는다 (등록이 막히지 않는다).
- 모델은 `fast` 티어를 쓴다.

### 4-2. `POST /api/stores/{id}/answers`

```python
from rules.engine import derive_business_type, business_type_reason

business_type = derive_business_type(pack, answers)      # 규칙이 정한다 (AI 아님). 답이 없으면 None
reason = business_type_reason(pack, answers)             # "주류 판매 → 일반음식점 (규칙)"
```

- 답변은 `answers`(jsonb)에 합쳐 저장하고 `business_type`을 갱신한다.
- 응답의 `questions`는 **빈 배열로 내려주면 된다.** 지금은 후속 질문이 없다. (`select_questions`를 다시 부르면 건너뛴 선택 질문이 또 나올 수 있다. 건너뛴 값은 `None`이라 미답으로 취급되기 때문이다.)

### 4-3. `POST /api/stores/{id}/analyze` — 분석 실행 + SSE

```python
import queue, threading
from agent.loop import run_analysis

def run(store: StoreInput, run_id: str, events: "queue.Queue"):
    cost = CostTracker()
    llm = make_llm(cost)
    try:
        result = run_analysis(
            store, tools=tools, calc=calc, llm=llm, pack=pack,
            emit=lambda event, data: events.put((event, data)),   # step | item | done
            include_grants=False,                                  # 정책 알림까지 같이 돌리려면 True
        )
        # 아래 4-3 저장 표대로 DB에 저장
    except Exception as e:                                         # 입력 형식 오류, calc 예외 등
        events.put(("error", {"code": "INTERNAL_ERROR", "message": str(e)}))

threading.Thread(target=run, args=(store, run_id, q), daemon=True).start()   # 또는 BackgroundTasks / to_thread
```

- **`run_analysis`는 동기·블로킹 함수다** (LLM 호출 포함, 가짜 도구 기준 10~20초). 이벤트 루프에서 직접 부르지 말고 스레드나 `asyncio.to_thread`로 돌린다.
- `emit`으로 나오는 이벤트가 API 명세서 4장 SSE 그대로다. `run_id`는 백엔드가 `done` 이벤트에 붙인다. 이벤트는 `runs.events`에도 쌓아서, SSE가 끊기면 `GET /runs/{id}`로 폴링할 수 있게 한다.
- 같은 가게의 분석이 이미 돌고 있으면 `409 RUN_IN_PROGRESS`는 백엔드가 판단한다.

**`AnalysisResult`를 저장하는 방법**

| `result` 필드 | 저장 위치 | 비고 |
| --- | --- | --- |
| `result.business_type` | `stores.business_type` | |
| `result.items` (`ReportItem`) | `report_items` | `options`, `recommendation`, `prepared`, `user_action`, `evidence`는 jsonb. `model_dump(mode="json")` 그대로 저장 |
| `result.checklist` (`ChecklistItem`) | `checklist_items` | 새 분석이면 이전 항목을 교체 (아래 5절 완료 체크 보존 참고) |
| `result.grants` (`GrantsResult`, `include_grants=True`일 때) | `grant_matches` | `items[*]`를 행으로, `excluded_count`·`closed_count`는 run 요약에 |
| `result.summary` | 응답의 `report.summary` | 저장하지 않고 항목에서 다시 세어도 같다 |
| `cost.rows` (`CostRow`: step, model, input_tokens, output_tokens, cost_krw) | `cost_logs` | `done` 이벤트의 `cost_krw`는 `result.cost_krw` |
| `result.guardrail_changes` | 로그 | 비어 있는 게 정상. 비어 있지 않으면 AI 출력을 가드레일이 고쳤다는 뜻이라 확인용으로 남긴다 |

### 4-4. `GET /report`, `GET /checklist`, `GET /dashboard` — AI 호출 없음

저장된 값을 읽어 API 명세서 형태로 조립만 하면 된다. `ReportItem`·`ChecklistItem`의 필드 이름은 명세서와 같다. `stage`별 묶음, `group_label`별 묶음은 백엔드가 만든다.

- `dashboard.pending_decisions`: `options`가 있고 `chosen_option`이 `None`인 항목.
- `dashboard.today_todos`: 각 항목의 `user_action`(할 일 1개, 소요 시간, `prepared_id`).

### 4-5. `POST /report/items/{item_id}/choose` — 선택지 적용 (AI 호출 없음)

선택지를 반영하는 일은 **코드가 정한 `apply`를 그대로 실행**하면 된다.

| `option.apply.type` | 백엔드 동작 |
| --- | --- |
| `update_store` | `payload`를 가게에 병합: `{"answers": {...}}`는 `answers`에 병합, `{"name": ...}`·`{"opening_date": ...}`는 해당 컬럼 수정 |
| `set_main_site` | `payload.site_id` 자리를 `is_main=true`로 (기존 기준 자리 해제) |
| `none` | `chosen_option`만 기록 |

- `needs_reanalyze: true`면 가게를 갱신한 뒤 `run_analysis`를 새로 돌리고 `run_id`를 돌려준다.
- 선택은 `report_items.chosen_option`, `chosen_at`에 기록한다. 재분석으로 항목이 교체되면 이전 선택은 사라진다.

### 4-6. `PATCH /stores/{id}` — 개업일 변경

개업일만 바뀌면 AI를 부르지 않고 체크리스트 날짜만 다시 계산한다.

- `source: rule`/`report` 항목은 모두 개업일 기준 상대 날짜라서 `due_date`를 **(새 개업일 − 이전 개업일)만큼 옮기면** 된다. `dday`와 `group_label`은 새 `due_date`와 새 개업일로 `calc.date_info(opening_date, due_date)`로 다시 구한다.
- `source: grant`(지원사업 마감) 항목은 `due_date`가 고정이므로 옮기지 않고 `dday`·`group_label`만 `date_info`로 다시 구한다.
- 주소·업종·답변이 바뀌면 `needs_reanalyze: true`만 돌려준다.

### 4-7. `POST /chat` — 내 가게 챗봇

```python
from agent.chat import ChatContext, chat
from agent.schemas import ReportItem, ChecklistItem

ctx = ChatContext(
    store=store,                                              # StoreInput (answers 포함)
    report_items=[ReportItem(**row) for row in report_rows],  # 이 가게의 저장된 리포트
    checklist=[ChecklistItem(**row) for row in checklist_rows],
)
reply = chat(llm, ctx, message=body.message, history=body.history, focus=body.focus)   # -> ChatReply
return reply.model_dump(mode="json")      # answer, evidence, actions, note
```

- `history`는 프론트가 보낸 리스트를 그대로 넘긴다 (서버에 저장하지 않는다. 길이 제한은 AI 모듈이 건다).
- `focus`는 `{"type": "report_item" | "checklist_item", "id": "r-01"}` 또는 생략.
- **`actions`는 제안일 뿐이고 서버가 반영하지 않는다.** 사용자가 확인하면 프론트가 아래 API를 호출한다.

| `action.type` | 프론트가 호출할 API |
| --- | --- |
| `update_store` | `PATCH /stores/{id}` (`payload` 그대로: `opening_date`, `name`, `answers`) |
| `choose_option` | `POST /report/items/{item_id}/choose` (`payload.item_id`, `payload.option_id`) |
| `check_item` | `PATCH /checklist/{item_id}` (`payload.done`) |
| `navigate` | 화면 이동 (`payload.target`: `report` / `checklist` / `map` / `grants`, 확인 불필요) |

- 사실을 묻는데 근거가 없으면 "이 가게의 점검 결과로는 알 수 없어요…"로 답한다 (세금 같은 범위 밖 질문 포함). 오류가 아니라 정상 응답이다.
- LLM이 실패하면 "지금은 답변을 만들지 못했어요"라는 기본 답변이 `200`으로 나간다.

### 4-8. `GET /grants` — 정책 알림

```python
from agent.grants import judge_grants, grant_checklist_items

res = tools.grants(store)                        # ToolResult
result = judge_grants(llm, store, res)           # -> GrantsResult
extra = grant_checklist_items(result, calc, store.opening_date, start_index=len(existing_checklist) + 1)
```

- 공고마다 LLM 호출이 1번 나간다 (공고 N건 → N번). 비싸고 느리므로 **결과를 `grant_matches`에 저장하고 `GET`은 저장본을 읽는다.** 새로 판정하는 시점은 분석 실행, "다시 조회", 가게 정보 변경 후다.
- `filter` 처리(`all | eligible | closing_soon`)는 백엔드가 저장된 결과에서 한다. `closing_soon` 기준(예: 14일)도 백엔드가 정한다.
- `grant_checklist_items`가 돌려준 항목을 체크리스트에 추가하고, 나이 판정에는 `stores.owner_birth_year`를 `StoreInput.owner_birth_year`로 넘겨야 한다 (없으면 나이 조건은 `unknown`).
- `result.ok == False`는 공고 조회 실패다 (`items`는 빈 배열).

### 4-9. `POST /sites`, `POST /sites/compare` — 후보 자리

후보 자리를 **추가할 때** 백엔드가 채워서 저장해야 하는 값:

| `Site` 필드 | 값 | 출처 |
| --- | --- | --- |
| `floor_uses` | 그 자리의 층 용도 목록 | `tools.building`을 그 주소로 호출 |
| `area_metrics` | `{"same_type_count": 14, "open_close_trend": {"available": False}, "foot_traffic": {"available": False}}` | 상가(상권)정보 반경 조회. **없는 지표는 `{"available": False}`로 두고 숫자를 만들지 않는다** |
| `listing` | `deposit_krw`, `monthly_rent_krw`, `maintenance_krw`, `premium_krw`, `area_m2` | 사용자 입력 (`PATCH /sites/{id}`) |
| `area_avg_rent_per_m2` | 지역 평균 ㎡당 임대료 | 원천이 정해질 때까지 비워 두면 "평균 대비"는 데이터 없음 |

```python
from agent.location import compare_sites, site_building_check

sites = [Site(**row) for row in site_rows]                       # listing이 입력된 자리 (또는 요청의 site_ids)
result = compare_sites(llm, store, sites, pack)                  # -> CompareResult
result.model_dump(mode="json")
```

- `GET /map`의 자리별 `building_check`는 `site_building_check(pack, business_type, site)`를 쓰면 된다 (LLM 없음).
- `summary_by`가 `rule`이면 AI 요약이 숫자 검증을 통과하지 못했거나 LLM이 실패해서 규칙 요약이 나간 것이다. 정상 동작이다.

### 4-10. `POST /api/demo` — 예시로 해보기

AI 모듈을 부르지 않는다. `backend/mocks/demo/seoyeon.json`을 복사해 새 `store_id`로 만든다 (외부 API·LLM이 모두 실패해도 동작).

| 파일의 키 | 만들 것 |
| --- | --- |
| `store` | `stores` 행 (`store_id`를 새로 만들고 `is_demo=true`). 이 안의 `sites`는 `sites` 행으로 |
| `report_items` | `report_items` (id는 그대로 써도 된다, 가게 안에서만 유일하면 된다) |
| `checklist` | `checklist_items` |
| `grants` | `grant_matches` (`items[*]`를 행으로) |
| `site_compare` | 후보 자리 비교 결과. 저장하지 않고 응답에 쓰거나 `sites.listing_result`에 넣는다 |
| `questions` | 가게 등록 직후 보여줄 되묻기 질문 |
| `events` | 새 `runs` 행(`trigger: demo`, `status: done`)의 `events`. SSE는 이 이벤트를 짧은 간격으로 재생한다 |

- 파일 최상단의 `is_example: true`, `example_notice`는 화면에 "예시 데이터" 배지를 붙이는 데 쓴다. 이 데이터의 법령 조문·상표·공고는 모두 가상이다.
- 파일을 다시 만들려면 `python scripts/build_demo.py` (실제 LLM 호출). 체크리스트 날짜 구분 기준이 확정되면 `FakeCalc` 대신 실제 `calc`로 다시 만들어야 한다.

---

## 5. 운영상 주의

- **완료 체크 보존**: 분석을 다시 돌리면 `result.checklist`의 `done`은 모두 `False`다. 이전 `done` 값은 `task` 이름이 같은 항목끼리 이어 받아서 저장한다.
- **무료 호출 한도**: Gemini 무료 티어는 분당·일일 호출 한도가 있어서 `429`가 나면 AI 모듈이 2초 쉬고 1번 재시도한 뒤 해당 단계를 "AI 없이" 처리한다 (분석은 끝나지만 설명·선택지 품질이 낮아진다). 시연 직전에는 한도 확인이 필요하고, 심사 접속이 몰리면 새 분석이 실패할 수 있다. "예시로 해보기"는 저장 결과라 영향이 없다. Gemini 무료 티어는 입력이 Google 제품 개선에 쓰일 수 있어서 실제 사용자 데이터에는 쓰지 않는다.
- **LLM 연속 실패 보호**: `run_analysis`는 내부에서 LLM을 `GuardedLLM`으로 감싼다. 3번 연속 실패하거나 분석이 150초를 넘기면 남은 AI 호출을 기다리지 않고 건너뛰고, 해당 단계는 SSE에서 `fallback`으로 나간다. 다른 함수(`chat`, `compare_sites` 등)는 호출이 1~몇 번이라 따로 감싸지 않았다. 시연 전 점검은 `시연_전_점검.md`를 본다.
- **동시 실행**: LLM 객체와 `CostTracker`는 **분석(요청) 1회마다 새로 만든다.** 비용 기록이 섞이지 않는다.
- **캐시**: 같은 공고·조문의 AI 판정 결과 캐시는 아직 없다. 필요하면 `judge_grants`의 공고별 호출 앞에서 `grant_id` + 본문 해시로 캐시하면 된다.
- **응답 직렬화**: AI 모듈의 결과는 pydantic 모델이다. `model_dump(mode="json")`으로 내보내면 날짜·시각이 문자열로 바뀐다.
- **판정 값**: `verdict`는 `high | low | unknown | ok` 4가지다 (`CLAUDE.md`의 3단계와 다르다. API 명세서 기준).

---

## 6. 백엔드와 확인할 것

이슈 #6, #8, #10, #12, #14의 "백엔드 연결 확인" 항목에 해당한다.

- [ ] `tools.building` 반환의 `floor_uses`가 **가게 층 기준**으로 나오는지, `violation`이 없을 때 `None`인지
- [ ] `tools.trademark`, `tools.law`, `tools.grants`의 `data` 형태와 `ok=False` 처리
- [ ] 지원사업 응답의 공고문 본문(`text`)을 한 덩어리로 만드는 방법
- [ ] `calc.checklist_dates`, `calc.date_info` 구현과 **`group_label` 구간 기준**
- [ ] `run_analysis`를 스레드에서 돌리고 `emit`을 SSE 큐로 연결하는 방식
- [ ] `AnalysisResult` 저장 매핑(4-3)과 재분석 시 `done` 이어받기
- [ ] `POST /demo`가 `seoyeon.json`을 복사하는 방식 (4-10)
- [ ] 후보 자리 추가 시 `floor_uses`·`area_metrics` 저장
- [ ] 챗봇 `actions`를 프론트가 호출하는 API 매핑(4-7)이 프론트와 맞는지
