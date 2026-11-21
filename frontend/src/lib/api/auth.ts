/** 아이디·비밀번호 회원가입·로그인 API (POST /api/auth/signup, /login, /logout). */
import { ApiError, apiEnabled, apiFetch } from "@/lib/api/client";
import { clearSession, loadSession, saveSession } from "@/lib/api/foundy-api";
import type { ApiAuthSession } from "@/lib/api/types";

function requireApi() {
  if (!apiEnabled())
    throw new ApiError(0, "API_DISABLED", "서버 주소가 설정되지 않았어요. 관리자에게 문의해 주세요.");
}

/** 로그인·가입 응답을 서버 세션으로 저장한다. 가게가 있으면 storeId 가 들어 있다. */
function remember(session: ApiAuthSession) {
  saveSession({ token: session.access_token, storeId: session.store_id, kind: "account" });
  return session;
}

export async function signup(input: { username: string; password: string; name: string }) {
  requireApi();
  return remember(await apiFetch<ApiAuthSession>("/api/auth/signup", { method: "POST", body: input }));
}

export async function login(input: { username: string; password: string }) {
  requireApi();
  return remember(await apiFetch<ApiAuthSession>("/api/auth/login", { method: "POST", body: input }));
}

/** 서버 토큰을 폐기하고 지운다. 서버가 응답하지 않아도 이 브라우저에서는 로그아웃된다. */
export async function logoutServer() {
  const session = loadSession("account");
  if (!session) return;
  clearSession();
  if (!apiEnabled()) return;
  try {
    await apiFetch<void>("/api/auth/logout", { method: "POST", token: session.token });
  } catch {
    // 이미 만료됐거나 서버가 꺼져 있으면 무시한다.
  }
}
