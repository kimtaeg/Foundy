# 로그인 화면

[SignInPage](https://21st.dev/@bhomikproductivitylab/components/sign-in-page)의 전체 화면 분할 구성을 참고해 Foundy 로그인에 적용했습니다. 기존 SignIn6 기반 카드 외곽을 없애고 이미지와 폼이 화면을 절반씩 차지하도록 구성했습니다. 기존 소스의 출처는 `THIRD_PARTY_NOTICES.md`에 남겨 두었습니다.

## 화면 구성

- 화면 전체를 사용하는 50:50 분할 레이아웃입니다. 카드 최대 너비·테두리·모서리·외부 여백을 없앴습니다. 오른쪽 폼은 최대 400px로 제한해 중앙 정렬합니다.
- 폼은 브랜드, 환영 제목, 입력 영역, 제출 버튼, 미리보기 안내 순으로 재구성했습니다. 입력과 버튼은 52px 높이·12px 라운드로 통일하고, 옅은 neutral 입력 배경과 primary 버튼을 사용합니다.
- 왼쪽은 제공받은 `Variant4-1.png`를 원본 그대로 `public/images/login/foundy-preview.png`에 보관합니다. Next Image의 품질을 95로 설정하고 1080/2048px 소스를 제공해 작은 글씨의 압축 손실을 줄였습니다. 이미지 자체의 그레인 질감은 원본 디자인입니다.
- 최소 높이는 `100dvh`입니다. 오류 메시지·큰 글씨·낮은 창에서는 내용 높이에 맞게 자연스럽게 스크롤됩니다.
- 768px 미만에서는 이미지 패널을 숨기고 로그인 폼만 표시합니다. 모바일 폼 좌우 여백은 24px입니다.
- 소셜 버튼·구분선·회원가입·비밀번호 찾기 링크를 제거하고 아이디와 비밀번호만 제공합니다.
- 입력과 버튼은 44px 이상, 라벨과 설명은 14px, 보조 안내는 12px로 가독성 기준을 유지합니다.

## 컴포넌트와 API 연결

`LoginView → LoginLayout → LoginArtwork / LoginBrand / LoginHeading / LoginForm / LoginDemoNotice`

폼 입력은 `LoginField`, 비밀번호 표시 전환은 `PasswordField`, 제출 버튼은 `LoginSubmitButton`, 제출 상태는 `useSignInForm`으로 분리합니다. 공개 컴포넌트와 타입은 각 `index.ts`에서 내보냅니다.

```tsx
<LoginView onSignIn={async ({ username, password }) => {
  // 인증 API 호출과 성공 후 세션/화면 전환을 연결합니다.
  await signInWithApi({ username, password });
}} />
```

`SignInHandler`는 성공 시 완료하고 실패 시 예외를 던지는 계약입니다. 폼은 제출 중 중복 요청을 막고 오류를 화면에 표시합니다. 비밀번호는 브라우저 저장소에 저장하지 않습니다.

현재 앱에는 실제 인증 서버가 없으므로 명시된 미리보기 계정 **demo / demo**만 기존 시연 데이터로 연결합니다. 일반 아이디·비밀번호의 서버 인증이나 계정 생성 기능은 포함하지 않습니다. `onSignIn`을 생략하면 연결 안내를 표시하며 성공으로 처리하지 않습니다.
