# 백엔드 API 연결과 오류 QA

- [x] 백엔드 FastAPI OpenAPI에서 서비스 운영 38개를 추출하고 프론트 호출부 및 테스트 파일과 대조.
- [x] 인증이 필요한 31개 운영 모두 토큰 없음과 잘못된 토큰을 FastAPI에서 요청. 62건 모두 HTTP 401, 동일한 오류 JSON, 허용된 브라우저 Origin 헤더 확인.
- [x] 예상하지 못한 HTTP 500에서 공개 오류 메시지만 반환하고 Origin 허용 정책 유지. 알려진 404, 200 상태 확인, 응답 시작 후 SSE 예외까지 포함해 `backend/tests/test_error_delivery.py` 68건 통과.
- [x] 새 로컬 PostgreSQL에 Alembic 마이그레이션을 적용한 뒤 `test_error_delivery.py`, `test_api_flow.py`, `test_law_rag.py` 총 107건 통과. 지원사업 저장 상태, AI 상담 기록·접근 제한·삭제 후 상태, 법령 검색과 적용 의무를 DB 재조회로 확인. 공고 공급자와 AI 답변은 테스트 대역 사용.

아래 표의 테스트는 소스에서 확인한 검증 근거입니다. DB 연결과 외부 서비스가 필요한 테스트의 현재 실행 상태는 별도 실행 결과를 기준으로 확인합니다. 브라우저 테스트의 HTTP 응답 가로채기는 프론트 처리 검증에 사용합니다.

## 계정과 서비스 상태

| 메서드와 경로 | 실제 프론트 호출 | 정상 응답과 예외 검증 근거 |
| --- | --- | --- |
| `GET /api/health` | 사용자 UI 호출 없음. 서버 상태 확인용 | `test_error_delivery.py` · DB 상태 표시와 내부 예외의 안전한 500 |
| `POST /api/demo` | 로그인에서 기존 `demo/demo` 입력 시 사용 | `test_api_flow.py` · 데모 세션·대시보드 생성. `test_auth.py` · 데모 세션 격리·폐기 |
| `POST /api/auth/social/start` | 아이디 로그인 화면에서 호출 없음 | `test_auth.py` · 인증 URL, 허용되지 않은 리다이렉트, 설정 누락 |
| `POST /api/auth/social` | 아이디 로그인 화면에서 호출 없음 | `test_auth.py` · 공급자별 콜백, 중복 처리, 만료·재사용·공급자 오류 |
| `POST /api/auth/signup` | 회원가입 | `test_password_auth.py` · 토큰 발급·비밀번호 해시, 중복·유효성·요청 제한 |
| `POST /api/auth/login` | 아이디 로그인 | `test_password_auth.py` · 대소문자 허용, 잘못된 인증, 요청 제한 |
| `POST /api/auth/logout` | 내비게이션과 마이페이지 로그아웃 | `test_password_auth.py`, `test_auth.py` · 토큰 폐기, 다른 세션 격리 |
| `GET /api/me` | 세션 복구, 초기 등록 및 가게 연결 상태 | `test_api_flow.py`, `test_auth.py` · 계정·가게 매핑, 유효하지 않거나 만료된 토큰 |
| `PATCH /api/me` | 마이페이지 계정 이름 저장 | `test_auth.py` · 계정 이름 변경 시 가게명 유지 |

## 가게, 점검 및 분석

| 메서드와 경로 | 실제 프론트 호출 | 정상 응답과 예외 검증 근거 |
| --- | --- | --- |
| `POST /api/stores` | 초기 등록 1단계 | `test_store_register.py` · 저장·질문, 잘못된 입력·중복·주소 후보·외부 서비스 오류 |
| `POST /api/stores/{store_id}/answers` | 초기 등록 추가 질문 | `test_store_register.py` · 영업 조건 반영, 잘못된 답변·타 계정·진행 중 및 종료 후 수정 거부 |
| `GET /api/stores/{store_id}` | 가게 정보 조회, 초기 등록 복구, 상권분석 시작 좌표 | `test_store_register.py`, `test_api_flow.py` · 저장값, 타 계정, 없는 가게 |
| `PATCH /api/stores/{store_id}` | 마이페이지와 체크리스트 개업일·영업 조건 등 저장 | `test_store_update.py`, `test_runs_api.py` · 날짜·업종·주소·체크리스트 반영, 잘못된 입력, 분석 중 충돌, 가게 데이터 보존 |
| `GET /api/stores/{store_id}/dashboard` | 대시보드 준비 현황, 점검·체크리스트 요약 | `test_api_flow.py` · 준비 현황·할 일, 타 계정 HTTP 403 |
| `GET /api/stores/{store_id}/report` | 점검 리포트 조회 | `test_api_flow.py`, `test_store_register.py` · 위험도 정렬·시기 조건·첫 분석 결과 |
| `POST /api/stores/{store_id}/report/items/{item_id}/choose` | 점검 항목 선택지 적용 | `test_api_flow.py`, `test_store_update.py`, `test_runs_api.py` · 선택 결과·재분석, 진행 중 변경 충돌 |
| `POST /api/stores/{store_id}/report/items/{item_id}/action` | 선택 이후 할 일 완료·완료 취소 | `test_api_flow.py` · 상태와 연동 체크리스트 반영, 잘못된 상태·없는 항목 |
| `GET /api/stores/{store_id}/changes` | 호출 없음. 가게 변경 이력용 | `test_store_update.py` · 변경 추적 및 최신 10건 |
| `POST /api/stores/{store_id}/analyze` | 초기 등록 분석 시작·재시도 | `test_store_register.py`, `test_runs_api.py` · 시작·재개, 중복 실행, 동시 요청, 용량 제한 |
| `GET /api/runs/{run_id}` | 분석 진행 상태와 스트림 복구 | `test_runs_api.py` · 분석 결과·비용 저장, 타 계정·잘못된 ID·없는 실행·시간 초과 |
| `GET /api/runs/{run_id}/stream` | 초기 등록 및 재분석 진행 SSE | `test_runs_api.py` · 이벤트 재생·재접속·연결 중단 후 분석 유지 |

## 체크리스트, 서류, 알림

| 메서드와 경로 | 실제 프론트 호출 | 정상 응답과 예외 검증 근거 |
| --- | --- | --- |
| `GET /api/stores/{store_id}/checklist` | 체크리스트, 연동 서류 화면 | `test_api_flow.py`, `test_store_register.py` · 저장된 항목, 단계 분류, 신규 분석 결과 |
| `PATCH /api/stores/{store_id}/checklist/{item_id}` | 대시보드·체크리스트 완료 상태 저장 | `test_api_flow.py` · 수동 상태 유지, 응답 상태 검증 |
| `GET /api/stores/{store_id}/documents` | 서류함 목록과 펼침 본문 | `test_documents.py`, `test_api_flow.py` · 독립된 준비 상태, 가게에 따른 서류, 타 계정 조회 거부 |
| `GET /api/stores/{store_id}/documents/{doc_key}` | 직접 호출 없음. 서류 본문은 목록 응답에 포함 | `test_documents.py` · 개별 발급기관·이력과 타 계정 조회 거부 |
| `PATCH /api/stores/{store_id}/documents/{doc_key}` | 서류 준비 상태 변경 | `test_documents.py`, `test_api_flow.py` · 상태·이력·재검토 확인, 잘못된 상태·없는 서류 |
| `GET /api/stores/{store_id}/alerts` | 공통 내비게이션 알림 | `test_alerts_as_of.py`, `test_api_flow.py` · 읽음 상태, 마감일 및 유형 조건 |
| `PATCH /api/stores/{store_id}/alerts/{alert_id}` | 알림 읽음 처리 | `test_api_flow.py`, `test_alerts_as_of.py` · 읽음 개수 반영, 잘못된 ID·가상 알림 수정 거부 |

## 법령, 지원사업, AI 상담

| 메서드와 경로 | 실제 프론트 호출 | 정상 응답과 예외 검증 근거 |
| --- | --- | --- |
| `GET /api/laws/search` | 브라우저 직접 호출 없음. 서버 내부 법령 검색 서비스 별도 사용 | `test_law_rag.py` · 저장된 법령의 검색 결과 및 랭킹, 잘못된 검색 조건·미인증 |
| `POST /internal/laws/refresh` | 브라우저 호출 없음. 내부 수집 작업용 | `test_law_rag.py` · 등록된 법령 대기열 등록, 잘못된 토큰·법령 이름 |
| `GET /api/stores/{store_id}/obligations` | 브라우저 직접 호출 없음 | `test_law_rag.py` · 가게별 적용 의무와 누락 정보·근거 조문 조회, 미인증 |
| `GET /api/stores/{store_id}/grants` | 지원사업 공고 조회 | `test_api_flow.py` · 초기에 빈 목록, 저장 후 조회, 공급자 실패 시 저장 목록 유지. `tests/grants-integration.mjs` · 브라우저에서 초기 공고 처리 |
| `POST /api/stores/{store_id}/grants/refresh` | ‘공고 새로 조회’ | `test_api_flow.py`, `test_grants.py` · 공고 갱신, 기존 판단 재사용, 공급자·판정 실패, `tests/grants-integration.mjs` · 표시와 재시도 |
| `POST /api/chat/sessions` | 상담 첫 질문의 세션 생성 | `test_api_flow.py` · 새 세션과 타 계정 가게 접근 거부, `tests/chat-api-integration.mjs` · 브라우저에서 새 세션 사용 |
| `GET /api/chat/sessions` | 상담 열 때 세션·메시지 복구 | `test_api_flow.py` · 첫 세션, 메시지 포함 옵션과 타 계정 가게 접근 거부, `tests/chat-api-integration.mjs` · 브라우저에서 기록 복구·오류 |
| `GET /api/chat/sessions/{session_id}/messages` | 목록 응답에 기록이 없을 때 개별 조회 | `test_api_flow.py` · 저장된 대화, 타 계정 접근·삭제된 세션, `tests/chat-api-integration.mjs` · 브라우저에서 기록 조회 |
| `POST /api/chat/sessions/{session_id}/messages` | 상담 질문 전송 및 SSE 응답 | `test_api_flow.py` · 정상 SSE와 모델 실패 SSE, 저장된 답변·오류 안내, 잘못된 입력과 타 계정 차단. `test_chat_agent.py`, `test_chat.py` · 답변·근거. `tests/chat-api-integration.mjs` · 표시·오류·중단 |
| `DELETE /api/chat/sessions/{session_id}` | API 함수 정의만 있음. 상담 UI에서 호출 없음 | `test_api_flow.py` · 삭제, 목록 제거, 타 계정 차단 |

카카오 주소 검색·지도 및 정적 유동인구는 별도 프론트 연동입니다. 화면별 테스트 연결은 [페이지·컴포넌트 QA 체크리스트](./qa-component-inventory.md)를 참고하세요.
