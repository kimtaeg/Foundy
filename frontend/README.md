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

## 실행

```bash
cp .env.example .env.local
npm install
npm run dev   # http://localhost:3000
```
