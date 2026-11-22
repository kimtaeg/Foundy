import type { SignInHandler } from "@/types/auth";

/** Browser demo adapter only. This does not authenticate a real account. */
export function createDemoSignIn(onDemoSignIn: () => void): SignInHandler {
  return ({ username, password }) => {
    if (username !== "demo" || password !== "demo") {
      throw new Error("아이디와 비밀번호를 확인해 주세요.");
    }
    onDemoSignIn();
  };
}
