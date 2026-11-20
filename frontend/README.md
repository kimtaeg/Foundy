# frontend

Next.js + TypeScript + Tailwind. 아직 프로젝트를 생성하지 않았다.

## 화면

- 시작
- 입력·되묻기
- 조사 중 (SSE 진행 상황)
- 리포트 (`docs/report-schema.json` 기준)

## 공용 응답 형식

리포트는 `docs/report-schema.json`, 체크리스트는 `docs/checklist-schema.json`을 따른다.
서버 없이 개발할 때 `docs/examples/`의 정상·판단 불가·mock 리포트 및
시기별·카테고리별 체크리스트 JSON을 사용한다. 모두 합성 예시 데이터다.
필드 변경·검증 방법·아직 연결되지 않은 AI 내부 모델은 `docs/examples/README.md`를 참고한다.

연락처는 카드의 `contact`에서 `agency/phone/is_example/tip`을 읽는다.
서류는 `documents[]`의 `doc_id/name/agency/guide/links/contact`로 표시한다.
이전 `prepared`·연락처 `verified` 필드는 사용하지 않는다.

## 분석 진행 API

`POST /api/stores/{store_id}/analyze`의 202 응답에서 run_id를 받아
`GET /api/runs/{run_id}/stream` 또는 `GET /api/runs/{run_id}`로 진행을 확인한다.
SSE에도 Authorization: Bearer 토큰이 필요하므로 인증 헤더를 전달하는 fetch 스트림을 사용한다.
수신한 이벤트 id는 Last-Event-ID로 보내 재연결할 수 있다. done 이후 report/dashboard/checklist를 다시 조회한다.
연결이 끊겨도 분석은 계속된다. 폴링의 failed/error를 표시하고, fallback/from_mock 근거를 실제 조회로 표시하지 않는다.

## 실행

```bash
cp .env.example .env.local
npm install
npm run dev   # http://localhost:3000
```
