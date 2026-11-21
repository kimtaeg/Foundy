/** 로그인·회원가입 폼 처리. 화면은 입력창 id만 알고, 검증·API·로컬 로그인은 여기서 이어 준다. */
import { login as apiLogin, signup as apiSignup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

interface PasswordAuthContext {
  $(id: string): HTMLElement | null;
  /** 로컬 엔진에 로그인한다 (계정별 저장소 분리 키, 표시 이름, 로그인 방식) */
  login(userId: string, name: string, provider: string): void;
  toast(message: string): void;
  notify(): void;
}

const value = (context: PasswordAuthContext, id: string) => {
  const element = context.$(id);
  return element instanceof HTMLInputElement ? element.value : "";
};

const USERNAME = /^[a-z0-9]{4,20}$/;

function describe(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function createPasswordAuth(context: PasswordAuthContext) {
  let busy = false;

  async function run(work: () => Promise<{ userId: string; name: string }>) {
    if (busy) return;
    busy = true;
    try {
      const { userId, name } = await work();
      context.login(`local:${userId}`, name, "local");
    } catch (error) {
      context.toast(describe(error));
    } finally {
      busy = false;
      context.notify();
    }
  }

  return {
    login: () =>
      run(async () => {
        const username = value(context, "pwLoginId").trim().toLowerCase();
        const password = value(context, "pwLoginPw");
        if (!username || !password) throw new ApiError(0, "INVALID_INPUT", "아이디와 비밀번호를 입력해 주세요.");
        const session = await apiLogin({ username, password });
        return { userId: session.user.user_id, name: session.user.name };
      }),

    signup: () =>
      run(async () => {
        const username = value(context, "pwSignupId").trim().toLowerCase();
        const name = value(context, "pwSignupName").trim();
        const password = value(context, "pwSignupPw");
        if (!USERNAME.test(username))
          throw new ApiError(0, "INVALID_INPUT", "아이디는 영문 소문자와 숫자로 4~20자여야 해요.");
        if (!name) throw new ApiError(0, "INVALID_INPUT", "이름을 입력해 주세요.");
        if (password.length < 8)
          throw new ApiError(0, "INVALID_INPUT", "비밀번호는 8자 이상이어야 해요.");
        if (password !== value(context, "pwSignupPw2"))
          throw new ApiError(0, "INVALID_INPUT", "비밀번호가 서로 달라요.");
        const session = await apiSignup({ username, password, name });
        return { userId: session.user.user_id, name: session.user.name };
      }),
  };
}
