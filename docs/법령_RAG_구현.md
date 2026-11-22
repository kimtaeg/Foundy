# 법령 RAG 구현 (요식업 규제 분석)

> 기준 설계: `AI_모듈_연동_가이드.md`. 이 문서는 그 설계를 이 저장소에 어떻게 구현했는지, 어떻게 운영하는지, 설계와 다르게 한 점을 적는다.
> **판정값은 바꾸지 않았다.** 화면 판정은 그대로 위반 소지 높음·확인 권장·판단 불가·문제 없음 4가지다. 설계의 적용·미적용·확인 필요는 "어떤 조문을 읽고 어떤 카드를 만들지" 정하는 내부 상태로만 쓴다.

## 1. 처리 흐름

```text
[법제처 API] --수집--> laws · law_articles(조문·별표) --분할--> law_embeddings(조각 + vector(768))
                                                                   |
가게 입력(업종·주소·층·면적·직원·배달 …) --> 규칙 엔진(applicability_rules) --> 적용·확인 필요·미적용
                                                                   |
점검 항목 -> 하이브리드 검색(법령명 필터 + 키워드 + 벡터, RRF) -> 근거 조문 -> AI 판정 -> 인용 문장 원문 검증 -> 결과 카드
의무 찾기 검색 묶음(law_rag.discovery) -> 규칙이 다루지 않는 조문 -> AI가 의무 선택 -> 인용 문장 원문 검증 -> 동적 카드 + 체크리스트 작업
```

- AI는 법령 원문을 대체하지 않는다. 판정 AI는 검색된 조문 원문만 읽고, 인용한 조문·문장이 원문에 없으면 그 근거를 버린다 (기존 `agent/judge.py` 검증 그대로).
- 규칙 엔진 결과는 AI에 함께 전달하고, AI가 이와 다른 결론을 내면 코드가 되돌린다 (적용인데 "해당 없음" → 확인 권장, 입력 부족인데 "해당 없음" → 판단 불가).
- 저장된 법령이 없거나 검색이 실패하면 예전 방식(지정 조문 조회 → 캐시 → 모의)으로 대체한다. `LAW_RAG_ENABLED=false`로 끌 수 있다.
- **실제 모드(`USE_MOCK=false`)에서는 모의 조문을 근거로 쓰지 않는다** (#68).
  - 실제 조문은 저장된 법령 검색 결과, 법령 API 결과, 그 캐시만이다.
  - 실제 조문을 찾지 못했거나 모의 조문으로 대체됐으면 법령에 기대는 판정(건물 용도, 영업신고·근로계약·소방·표시 카드)은 `unknown`과 "판단에 필요한 실제 법령 조문을 찾지 못해 판정을 보류했어요"로 남긴다. 건물 용도는 건축물대장 근거만 남기고 AI를 부르지 않는다.
  - 실제 조문이 있으면 기존 조건(인용 문장 원문 검증, 규칙표 대조)을 통과해야 `high`다.
  - 건물만 다시 반영할 때(층·호 변경)도 건물 용도 조문 하나는 함께 찾는다.
  - 위반건축물(건축물대장 표기)과 상표는 법령과 별개로 판정한다. 명시한 모의 모드(`USE_MOCK=true`, 데모)는 그대로다.
  - 한계: `laws` 테이블에는 수집 경로(법제처 실시간 수집 / `ingest --mock`의 저장해 둔 실제 응답)를 구분하는 칸이 없다. 둘 다 실제 법령 원문이라 같은 실제 조문으로 취급한다.

## 2. 설계 항목 → 코드

| 설계 | 구현 |
| --- | --- |
| Law Collector | `backend/law_rag/collector.py` (법제처 `lawSearch`·`lawService`), 실행은 `python -m law_rag.ingest` |
| 조문 단위 분할 | `law_rag/parser.py` (조·별표·가지번호), `law_rag/chunker.py` (항·호·목 경계로 1,200자 이내 조각) |
| 임베딩 + pgvector | `law_rag/embedder.py` (기본 OpenAI `text-embedding-3-large`를 768차원으로 줄여 사용, 키가 없으면 Gemini `gemini-embedding-001`), `law_embeddings.embedding vector(768)` + HNSW 코사인 인덱스. 조각마다 만든 모델을 `model`에 저장하고 검색은 같은 모델이 만든 벡터끼리만 비교한다 |
| RAG Retriever | `law_rag/retriever.py`: 법령명·현행 필터 + 키워드(조각 본문) + 벡터 유사도를 RRF로 합침, 규칙이 지정한 조문(pins)은 항상 포함 |
| Rule Engine | `rules/applicability.py` + `rules/packs/cafe_restaurant.yaml`의 `applicability_rules` |
| AI Service | `agent/judge.py` `judge_law_card` (영업신고·원산지 표시·소방·근로계약 등 법령 카드를 하나의 흐름으로 처리) |
| 법령 변경 감지 | `law_rag/changes.py` + `POST /internal/laws/refresh` |
| 창업자 정보 구조화 | 가게 등록·되묻기 흐름에 영업장 면적(`area_sqm`)·배달(`does_delivery`) 추가. 자연어 입력 구조화는 하지 않는다(폼 입력) |

## 3. DB 매핑

| 설계 테이블 | 이 저장소 |
| --- | --- |
| `users` | `users` (아이디·비밀번호 계정 포함) |
| `founder_profiles` | `stores` (+ `area_sqm`, `does_delivery`) |
| `laws` · `law_articles` · `law_embeddings` | 같은 이름 (`0004_law_rag`). 조문 이력은 `law_article_history` |
| `applicability_rules` | 같은 이름. YAML 규칙을 `sync_rules()`로 동기화하고 검토 상태(`draft`/`reviewed`)를 둔다 |
| `legal_obligations` | 같은 이름. 분석 때 가게별로 저장, `GET /api/stores/{id}/obligations` |
| `compliance_tasks` | 기존 `checklist_items` |
| `law_change_logs` | 같은 이름 (바뀐 조문·영향받는 규칙·영향받는 가게 수) |

## 4. 점검 항목과 법령

| 점검 항목 | 읽는 법령 | 카드를 만드는 조건 |
| --- | --- | --- |
| `building_use` | 건축법 시행령(별표 1), 식품위생법 시행령, 건축법 | 항상 |
| `permit_docs` | 식품위생법·시행령·시행규칙 (제37조 고정) | 항상 |
| `labeling` | 원산지 표시법, 표시·광고법, 식품위생법 | 항상 (조문이 없으면 안내 카드) |
| `fire_safety` | 다중이용업소법·시행령 | 면적 100㎡ 이상 등 규칙이 적용될 때 (1층은 예외 확인 필요) |
| `labor_contract` | 근로기준법, 최저임금법 | 직원을 고용할 때 |

- 규칙이 모두 "미적용"이거나 입력이 없어 모르는 점검은 카드를 만들지 않는다. 그 결과는 의무사항 목록에 남고, 면적 같은 입력을 채우면 다시 판정된다.
- 이전 분석에서 만들었다가 더는 적용되지 않는 카드(선택·진행 전)는 재분석 때 지운다.

### 조문에서 의무 찾기 (`agent/discover.py`)

위 고정 점검과 적용 규칙만으로는 어떤 가게든 카드·작업 종류가 같아진다. 그래서 규칙 묶음이 다루지 않는 조문에서 AI가 이 가게의 의무를 더 찾는다.

- 검색: `law_rag.discovery.queries` 묶음마다 하이브리드 검색 (`when` 이 있으면 그 답변이 참일 때만: 직원 → 근로기준법, 주류 → 청소년 주류 제공 금지). 묶음을 번갈아 합쳐 `max_articles`(20)개까지, 조문당 `max_article_chars`(2,500)자까지 읽는다.
- 제외: 점검 카드가 이미 읽은 조문과 `applicability_rules` 의 조문은 AI에 넘기지 않고, 이미 다루는 의무 이름 목록도 함께 넘긴다.
- 채택 조건 (`accept`): 조문 key 가 검색 결과에 있고, 인용 문장이 원문에 있어야 한다 (말줄임 조각은 순서대로). 같은 조문·같은 문장은 한 번, 조문당 2개, 가게당 `max_items`(6)개까지.
- 결과: 카드 `law_found:<id>`(`low` 확인 권장, `decided_by: ai`, 근거 = 인용 문장 + 조문 링크, 할 일 1개)와 체크리스트 작업 `o-x<id>`(`legal_analysis`, applies → 필수 / needs_check → 조건부). 카드를 완료하면 작업이 자동 체크된다.
- 재분석: id 는 조문 + 인용 문장 앞부분의 해시라서 같은 의무는 같은 항목이다. 다시 찾지 못한 카드(선택 전)와 미완료 작업은 지우고, 완료한 작업은 `review_needed` 로 남긴다. AI가 실패한 분석에서는 이전 결과를 지우지 않는다.
- 비용: gpt-4.1 기준 1회 입력 약 1만 토큰·출력 약 1천 토큰.
- 한계: 같은 입력이라도 AI가 고르는 의무가 실행마다 조금 달라질 수 있다. 법정 기한(`statutory_deadline`)은 채우지 않는다.

## 5. 운영

```bash
cd backend
python -m law_rag.ingest --mock          # 저장해 둔 실제 응답(식품위생법·건축법 시행령)으로 적재, 법제처 접속 없음
python -m law_rag.ingest                 # law_sources 전체를 법제처에서 수집 (OC에 등록된 IP에서만 가능)
python -m law_rag.ingest --only 근로기준법 최저임금법
python -m law_rag.ingest --reembed       # 임베딩이 없거나 현재 모델과 다른 모델로 만든 조각을 다시 만듦
```

- 법제처 OC는 등록된 서버 IP에서만 동작한다. 수집은 배포 서버(Railway)나 등록한 PC에서 실행한다.
- 임베딩에 `EMBEDDING_API_KEY`(OpenAI, 모델은 `EMBEDDING_MODEL`, OpenAI 호환 서비스는 `EMBEDDING_BASE_URL`) 또는 `LLM_API_KEY`(Gemini)가 필요하다. 둘 다 없으면 조각은 저장되고 키워드 검색만 한다. 모델을 바꾼 뒤에는 `python -m law_rag.ingest --reembed`로 다른 모델이 만든 조각을 모두 다시 만든다. 목 모드(`USE_MOCK=true`)에서는 검색 때도 외부 호출 없이 키워드만 쓴다.
- 예약 갱신: 배포 환경의 스케줄러가 `POST /internal/laws/refresh`(`Authorization: Bearer INTERNAL_TOKEN`)를 부른다. 백그라운드로 재수집하고, 바뀐 조문이 걸린 규칙이 적용·확인 필요인 가게에만 `change` 알림을 만든다.
- 환경변수: `LAW_RAG_ENABLED`(기본 true), `INTERNAL_TOKEN`, `LAW_OC`, `EMBEDDING_API_KEY`·`EMBEDDING_MODEL`·`EMBEDDING_BASE_URL`, `LLM_API_KEY`.

## 6. 담당자가 확인할 것

- 적용 여부는 AI가 조문 원문을 읽고 판정한다 (`rules/ai_applicability.py`). 조문이 규칙보다 우선이라 검증된 AI 판정은 규칙과 달라도 따르고, 조문이 없거나 인용을 검증하지 못할 때만 규칙 엔진 결과를 쓴다. 화면의 "검토 전" 표시는 뺐다.
- `applicability_rules`의 조문 번호·면적 기준·예외는 모두 `review_status: draft`다. 법제처 원문으로 확인한 뒤 `reviewed`로 바꾼다 (설계 5.3의 검토 이력).
- `law_sources`의 법령명은 법제처 현행 법령명 한글과 정확히 같아야 한다.
- 지자체 조례(자치법규)와 토지이용계획·인허가 공공데이터는 아직 연결하지 않았다. 용도지역은 `ZONING-001`이 안내만 한다.

## 7. 설계와 다르게 한 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 판정 3가지(적용·미적용·확인 필요) | 화면은 4가지 유지, 3가지는 내부 상태 | 요청에 따라 판정값은 바꾸지 않는다 |
| 규칙을 DB 테이블에서 관리 | YAML이 원본, DB는 사본 | 업종 추가를 코드 수정 없이 하려는 구조를 유지하고, 사본으로 검토 상태·영향 추적을 한다 |
| 자연어 입력을 AI가 구조화 | 폼 입력 | 모르는 값은 null로 두고 되묻는 기존 흐름이 이미 같은 원칙이다 |
| 일정 관리 테이블 신설 | 기존 체크리스트 사용 | 이미 개업일 역산 체크리스트가 있다 |
