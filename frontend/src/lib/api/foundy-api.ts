/** 예시 계정 세션과 화면별 API 호출. */
import { apiFetch } from "@/lib/api/client";
import type {
  ApiAlert,
  ApiIdentity,
  ApiNextStep,
  ApiChecklist,
  ApiDashboard,
  ApiDemoSession,
  ApiDocumentRequirement,
  ApiDocuments,
  ApiGrants,
  ApiDocumentStatus,
  ApiPatchResult,
  ApiRegisterBody,
  ApiReport,
  ApiReportMutationUpdate,
  ApiResources,
  ApiChecklistState,
  ApiDocumentState,
  ApiSetup,
  ApiStore,
  ApiRent,
  ApiRentQuery,
} from "@/lib/api/types";

const SESSION_KEY = "foundy-api-session";

/** demo: 예시 계정(서버가 만든 가게 포함) · account: 아이디·비밀번호 계정 (가게는 없을 수 있다) */
export type SessionKind = "demo" | "account";

export interface ApiSession {
  token: string;
  /** 가게를 아직 등록하지 않은 계정은 null */
  storeId: string | null;
  kind: SessionKind;
}

const sessionEvent = "foundy-api-session-change";
let memorySession: string | null = null;
let identity: { token: string; value: ApiIdentity } | null = null;
const identityReads = new Map<string, Promise<ApiIdentity>>();

export function sessionSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return memorySession;
  }
}

export function subscribeSession(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SESSION_KEY && event.key !== null) return;
    // Another tab changed the signed-in account. Restore the engine and the token together.
    window.location.reload();
  };
  window.addEventListener(sessionEvent, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(sessionEvent, notify);
    window.removeEventListener("storage", onStorage);
  };
}

export function loadSession(kind?: SessionKind): ApiSession | null {
  try {
    const value = JSON.parse(sessionSnapshot() ?? "null") as ApiSession | null;
    if (!value || !value.token || !["demo", "account"].includes(value.kind)) return null;
    if (kind && value.kind !== kind) return null;
    if (value.kind === "demo" && !value.storeId) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveSession(session: ApiSession | null) {
  if (identity?.token !== session?.token) identity = null;
  memorySession = session ? JSON.stringify(session) : null;
  try {
    if (memorySession) localStorage.setItem(SESSION_KEY, memorySession);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be disabled. Keep the session for this tab.
  }
  window.dispatchEvent(new Event(sessionEvent));
}

export function clearSession() {
  saveSession(null);
}

export function getApiIdentity(token: string) {
  return identity?.token === token ? identity.value : undefined;
}

export function rememberApiIdentity(token: string, value: ApiIdentity) {
  if (loadSession()?.token === token) identity = { token, value };
  return value;
}

export function readApiIdentity(token: string): Promise<ApiIdentity> {
  const pending = identityReads.get(token);
  if (pending) return pending;
  const request = apiFetch<ApiIdentity>("/api/me", { token })
    .then(value => rememberApiIdentity(token, value))
    .finally(() => identityReads.delete(token));
  identityReads.set(token, request);
  return request;
}

/** POST /api/demo: 예시 계정을 만들고 세션과 초기 상태를 저장한다. */
export async function startDemoSession(): Promise<ApiSession> {
  const body = await apiFetch<ApiDemoSession>("/api/demo", { method: "POST" });
  const session: ApiSession = { token: body.access_token, storeId: body.store_id, kind: "demo" };
  saveSession(session);
  rememberApiIdentity(session.token, body);
  return session;
}

export function createStoreApi(session: ApiSession) {
  if (!session.storeId) throw new Error("가게가 아직 등록되지 않았어요");
  const base = `/api/stores/${session.storeId}`;
  const call = <T,>(path: string, method = "GET", body?: unknown) =>
    apiFetch<T>(`${base}${path}`, { method, body, token: session.token });

  return {
    store: () => call<ApiStore>(""),
    dashboard: () => call<ApiDashboard>("/dashboard"),
    report: () => call<ApiReport>("/report"),
    checklist: () => call<ApiChecklist>("/checklist"),
    alerts: () => call<{ items: ApiAlert[] }>("/alerts").then(response => response.items),
    documents: () => call<ApiDocuments>("/documents"),
    grants: () => call<ApiGrants>("/grants"),
    refreshGrants: () => call<ApiGrants>("/grants/refresh", "POST"),
    rent: (query: ApiRentQuery = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null) params.set(key, String(value));
      const search = params.toString();
      return call<ApiRent>(`/rent${search ? `?${search}` : ""}`);
    },
    choose: (itemId: string, optionId: string) =>
      call<ApiReportMutationUpdate & { applied_changes: string[]; added_checklist: string[]; run_id: string | null }>(
        `/report/items/${itemId}/choose`,
        "POST",
        { option_id: optionId },
      ),
    action: (itemId: string, status: "pending" | "sent" | "done", reply?: string) =>
      call<ApiReportMutationUpdate & { auto_checked: string[]; next_steps: ApiNextStep[] }>(`/report/items/${itemId}/action`, "POST", {
        status,
        ...(reply ? { reply } : {}),
      }),
    setTaskDone: (itemId: string, done: boolean) =>
      call<ApiChecklistState>(`/checklist/${itemId}?detail=status`, "PATCH", { done }),
    /** 법령 개정 등으로 표시된 "다시 확인" 안내를 확인했다고 알린다 */
    ackTaskReview: (itemId: string) => call<unknown>(`/checklist/${itemId}`, "PATCH", { review_ack: true }),
    /** 서류 상태를 바꾼다 (발급·취득 완료와 제출 완료는 다른 상태다) */
    setDocumentStatus: (docKey: string, status: ApiDocumentStatus) =>
      call<ApiDocumentState & { catalog_changed?: boolean }>(`/documents/${docKey}?detail=status`, "PATCH", { status }),
    ackDocumentReview: (docKey: string) =>
      call<ApiDocumentRequirement>(`/documents/${docKey}`, "PATCH", { review_ack: true }),
    readAlert: (alertId: string) => call<ApiAlert>(`/alerts/${alertId}`, "PATCH", { read: true }),
    /** 가게 정보 수정. dryRun 이면 저장하지 않고 영향(impacts·reset_items)만 돌려준다. 미리보기와 저장은 같은 본문을 쓴다. */
    patchStore: (body: Record<string, unknown>, dryRun = false) =>
      call<ApiPatchResult>(dryRun ? "?dry_run=true" : "", "PATCH", body),
    saveAnswers: (answers: Record<string, unknown>) => call<{ setup: ApiSetup }>("/answers", "POST", { answers }),
    analyze: () => call<{ run_id: string }>("/analyze", "POST"),
    runStatus: (runId: string) =>
      apiFetch<{ status: string }>(`/api/runs/${runId}`, { token: session.token }),
  };
}

export type StoreApi = ReturnType<typeof createStoreApi>;

/** 가게 등록 전에도 쓰는 계정 단위 호출 */
export function createAccountApi(session: ApiSession) {
  return {
    registerStore: (body: ApiRegisterBody) =>
      apiFetch<{ store_id: string; setup: ApiSetup }>("/api/stores", { method: "POST", body, token: session.token }),
  };
}

export function readStoreResources(session: ApiSession): { [K in keyof ApiResources]: () => Promise<ApiResources[K]> } {
  const api = () => createStoreApi(session);
  return {
    me: () => readApiIdentity(session.token),
    store: () => api().store(),
    dashboard: () => api().dashboard(),
    report: () => api().report(),
    checklist: () => api().checklist(),
    documents: () => api().documents(),
    grants: () => api().grants(),
    alerts: () => api().alerts(),
  };
}
