# 카페·음식점 창업 전 사전 점검 에이전트

카페·음식점을 여는 청년을 위한 **창업 전 사전 점검 에이전트**.
업종, 주류 판매 여부, 주소(층), 가게 이름, 개업 예정일을 입력하면 건축물대장·법령·상표를 조회해
"계약 전 꼭 확인 / 개업 전 할 일 / 운영 중 주의" 리포트와 개업 역산 일정표를 만든다.
문제가 나온 항목은 판정만 던지지 않고 선택지·추천·대신 만든 결과물(구청 문의 문자, 특약 문구, 서류 초안)을 함께 보여줘서, 사용자는 결정 한 번으로 끝낸다.

> 이 서비스는 법률 자문이 아닌 사전 점검 도구입니다.

## 배포 링크

- 프론트엔드: TODO
- 백엔드: TODO

## 폴더 구조

```text
startup_agent/
├── README.md                 # 서비스 소개, 실행 방법, 배포 링크 (심사용)
├── CLAUDE.md                 # 협업·작업 규칙
├── .coderabbit.yaml          # CodeRabbit 리뷰 설정
├── .gitignore
├── .github/                  # PR·이슈 템플릿
├── docs/
│   ├── mvp.md                # MVP 명세서
│   ├── api-research.md       # 사전조사 결과 (API별 응답 예시)
│   └── report-schema.json    # 리포트 JSON 형식 (프론트·백 공용 약속)
│
├── frontend/                 # 역할 C
│   ├── app/
│   │   ├── page.tsx          # 시작 화면
│   │   ├── check/            # 입력 + 되묻기
│   │   └── report/[id]/      # 조사 중 + 리포트
│   ├── components/
│   ├── lib/api.ts            # 백엔드 호출, SSE 수신
│   └── .env.example
│
└── backend/
    ├── main.py               # FastAPI 진입점, /check, /check/stream
    ├── agent/                # 역할 A — AI는 여기
    │   ├── loop.py           # 에이전트 루프 (LLM ↔ 도구)
    │   ├── prompts/          # 시스템 프롬프트, 되묻기, 리포트 작성
    │   ├── report.py         # 판정 3단계, 리포트 조립
    │   └── cost.py           # 토큰·비용 기록
    ├── tools/                # 역할 B
    │   ├── address.py        # 도로명주소
    │   ├── building.py       # 건축물대장
    │   ├── law.py            # 국가법령정보
    │   ├── trademark.py      # KIPRIS
    │   └── cache.py
    ├── rules/                # 역할 D
    │   └── cafe_restaurant.yaml
    ├── mocks/                # API별 모의 응답 JSON (승인 전 개발, 시연 안전장치)
    ├── tests/
    │   └── scenarios/        # S1~S4 데모 시나리오 입력과 기대 결과
    ├── requirements.txt
    └── .env.example          # API 키 이름만 적고 값은 비움
```

## 실행 방법

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
USE_MOCK=true uvicorn main:app --reload   # http://localhost:8000

# frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev                               # http://localhost:3000
```

API 키가 없어도 `USE_MOCK=true`로 모의 응답을 써서 끝까지 실행할 수 있습니다.
