/** 예시 계정 세션과 화면별 API 호출. */
import { apiFetch } from "@/lib/api/client";
import type {
  ApiAlert,
  ApiBundle,
  ApiChecklist,
  ApiDashboard,
  ApiDemoSession,
  ApiReport,
  ApiStore,
} from "@/lib/api/types";

const SESSION_KEY = "foundy-api-session";

export interface ApiSession {
  token: string;
  storeId: string;
}

export function loadSession(): ApiSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    return value && typeof value.token === "string" && typeof value.storeId === "string" ? value : null;
  } catch {
    return null;
  }
}

function saveSession(session: ApiSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // 저장소를 못 쓰면 이번 탭에서만 세션을 유지한다.
  }
}

export function clearSession() {
  saveSession(null);
}

/** POST /api/demo: 예시 계정(이서연)을 새로 만들고 토큰을 받는다. */
export async function startDemoSession(): Promise<ApiSession> {
  const body = await apiFetch<ApiDemoSession>("/api/demo", { method: "POST" });
  const session = { token: body.access_token, storeId: body.store_id };
  saveSession(session);
  return session;
}

export function createStoreApi(session: ApiSession) {
  const base = `/api/stores/${session.storeId}`;
  const call = <T,>(path: string, method = "GET", body?: unknown) =>
    apiFetch<T>(`${base}${path}`, { method, body, token: session.token });

  return {
    async loadBundle(): Promise<ApiBundle> {
      const [store, dashboard, report, checklist, alerts] = await Promise.all([
        call<ApiStore>(""),
        call<ApiDashboard>("/dashboard"),
        call<ApiReport>("/report"),
        call<ApiChecklist>("/checklist"),
        call<{ items: ApiAlert[] }>("/alerts"),
      ]);
      return { store, dashboard, report, checklist, alerts: alerts.items };
    },
    choose: (itemId: string, optionId: string) =>
      call<{ applied_changes: string[]; added_checklist: string[]; run_id: string | null }>(
        `/report/items/${itemId}/choose`,
        "POST",
        { option_id: optionId },
      ),
    action: (itemId: string, status: "pending" | "sent" | "done", reply?: string) =>
      call<{ auto_checked: string[] }>(`/report/items/${itemId}/action`, "POST", {
        status,
        ...(reply ? { reply } : {}),
      }),
    setTaskDone: (itemId: string, done: boolean) =>
      call<unknown>(`/checklist/${itemId}`, "PATCH", { done }),
    readAlert: (alertId: string) => call<unknown>(`/alerts/${alertId}`, "PATCH", { read: true }),
    runStatus: (runId: string) =>
      apiFetch<{ status: string }>(`/api/runs/${runId}`, { token: session.token }),
  };
}

export type StoreApi = ReturnType<typeof createStoreApi>;
