/** 아이디·비밀번호 회원가입·로그인 API (POST /api/auth/signup, /login, /logout). */
import { ApiError, apiEnabled, apiFetch } from "@/lib/api/client";
import type { ApiAuthSession } from "@/lib/api/types";

const AUTH_KEY = "foundy-auth-token";

function requireApi() {
  if (!apiEnabled())
    throw new ApiError(0, "API_DISABLED", "서버 주소가 설정되지 않았어요. 관리자에게 문의해 주세요.");
}

function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(AUTH_KEY, token);
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    // 저장소를 못 쓰면 이번 탭에서만 로그인이 유지된다.
  }
}

export function loadAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_KEY);
  } catch {
    return null;
  }
}

export async function signup(input: { username: string; password: string; name: string }) {
  requireApi();
  const session = await apiFetch<ApiAuthSession>("/api/auth/signup", { method: "POST", body: input });
  saveToken(session.access_token);
  return session;
}

export async function login(input: { username: string; password: string }) {
  requireApi();
  const session = await apiFetch<ApiAuthSession>("/api/auth/login", { method: "POST", body: input });
  saveToken(session.access_token);
  return session;
}

/** 서버 토큰을 폐기하고 지운다. 서버가 응답하지 않아도 이 브라우저에서는 로그아웃된다. */
export async function logoutServer() {
  const token = loadAuthToken();
  saveToken(null);
  if (!token || !apiEnabled()) return;
  try {
    await apiFetch<void>("/api/auth/logout", { method: "POST", token });
  } catch {
    // 이미 만료됐거나 서버가 꺼져 있으면 무시한다.
  }
}
