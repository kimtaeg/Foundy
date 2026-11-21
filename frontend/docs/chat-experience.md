# 상담 위젯 UI와 처리 상태

## 디자인 참고

- [Thinking Prompt Input — dhxwhy](https://21st.dev/@dhxwhy/components/thinking-prompt-input): 하단 입력 카드, 여러 줄 질문, 전송·중지, 경과시간 표현.
- [Chat Reasoning — asanshay](https://21st.dev/@asanshay/components/chat-reasoning): 접이식 처리 내역과 세로 타임라인.

두 공개 데모를 참고하여 Foundy의 React/Tailwind 컴포넌트로 독립 구현했다. 원본 소스를 복사하거나 AI SDK·아이콘 라이브러리 의존성을 추가하지 않았다. 흰색·neutral 표면, primary `#107e7d`, 본문 14px, 입력 16px, 보조 정보 최소 12px를 사용한다.

## 현재 동작

현재 응답은 `reply-model.ts`의 로컬 규칙 기반 예시이며, 외부 AI 서버·검색·DB 조회를 실행하지 않는다. 화면에도 예시 응답 모드를 표시한다. ‘처리 내역’은 사고 과정 대신 실제 요청 접수, 반환된 안내·연락처·변경 제안, 적용 결과만 보여준다. 경과시간은 요청의 시작·종료 시간에서 계산한다.

- 입력: Enter 전송, Shift+Enter 줄바꿈, 한글 조합 중 Enter 전송 방지. 최대 300자.
- 진행 중: 현재 요청만 중지할 수 있고, 다음 질문의 초안을 계속 입력할 수 있다.
- 완료: 관련 안내와 변경 제안을 펼쳐 확인한다. 가게 정보 변경은 기존 ‘확인하고 적용’ 이후에만 실행된다.
- 중지·오류: 입력을 다시 사용할 수 있고, 같은 질문을 다시 요청할 수 있다.
- 대화 스크롤: 하단을 보고 있으면 새 응답을 따라간다. 이전 답변을 읽는 중에는 위치를 유지하고 ‘새 답변 보기’를 제공한다.
- 키보드: 열면 입력에 포커스, Escape로 닫고 실행 버튼으로 포커스를 돌린다. 접이식 내역은 버튼으로 열고 닫으며 경과시간을 반복해서 음성 안내하지 않는다.

## 구성

`ChatPanel`이 헤더·대화·입력 영역을 배치한다. `ChatComposer`와 `ChatSubmitButton`은 입력을, `ChatProcessing`과 `ChatProcessingStep`은 상태와 타임라인을, `ChatMessage`와 `ChatActionCard`는 답변·확인 동작을 맡는다. 각 컴포넌트는 독립 디렉토리와 `index.ts`를 제공한다.

`chat-request.ts`는 요청·중지·재시도와 오류 복구를 담당한다. 메시지와 진행 상태 타입은 `types/chat.ts`, 초기 상태는 `chat-state.ts`에서 관리한다. 요청 타이머는 개별 취소하며 로그인·로그아웃·가게 초기화 시 기존 task scope가 오래된 콜백의 반영을 막는다.

## 검증

- `node tests/chat-request.mjs`: 요청 완료·취소·오류·재시도·세션 상태 교체.
- `node tests/chat-widget.mjs`: 데스크톱·모바일 입력, 처리 내역, 변경 확인, 대화 스크롤, 포커스.
- 기존 `test:functional`, TypeScript, ESLint, `test:architecture`와 프로덕션 빌드를 함께 확인한다.
