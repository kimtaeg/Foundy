/** 예시 계정 세션과 화면별 API 호출. */
import { apiDownload, apiFetch, apiUpload } from "@/lib/api/client";
import type {
  ApiAlert,
  ApiBundle,
  ApiChangeLog,
  ApiChecklist,
  ApiDashboard,
  ApiDemoSession,
  ApiDocumentRequirement,
  ApiDocuments,
  ApiDocumentStatus,
  ApiObligation,
  ApiPatchResult,
  ApiRegisterBody,
  ApiReport,
  ApiStore,
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

/** 저장된 세션. 종류가 다르면(예: 예시 계정으로 들어왔는데 일반 계정 세션이 남아 있음) 쓰지 않는다. */
export function loadSession(kind: SessionKind = "demo"): ApiSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    if (!value || typeof value.token !== "string") return null;
    const savedKind: SessionKind = value.kind === "account" ? "account" : "demo";
    if (savedKind !== kind) return null;
    const storeId = typeof value.storeId === "string" ? value.storeId : null;
    if (kind === "demo" && !storeId) return null;
    return { token: value.token, storeId, kind };
  } catch {
    return null;
  }
}

export function saveSession(session: ApiSession | null) {
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
  const session: ApiSession = { token: body.access_token, storeId: body.store_id, kind: "demo" };
  saveSession(session);
  return session;
}

export function createStoreApi(session: ApiSession) {
  if (!session.storeId) throw new Error("가게가 아직 등록되지 않았어요");
  const base = `/api/stores/${session.storeId}`;
  const call = <T,>(path: string, method = "GET", body?: unknown) =>
    apiFetch<T>(`${base}${path}`, { method, body, token: session.token });

  return {
    async loadBundle(): Promise<ApiBundle> {
      const [store, dashboard, report, checklist, alerts, obligations, documents] = await Promise.all([
        call<ApiStore>(""),
        call<ApiDashboard>("/dashboard"),
        call<ApiReport>("/report"),
        call<ApiChecklist>("/checklist"),
        call<{ items: ApiAlert[] }>("/alerts"),
        // 법령 적용 결과는 보조 정보라서 못 받아도 화면은 그린다
        call<{ items: ApiObligation[] }>("/obligations").catch(() => ({ items: [] as ApiObligation[] })),
        // 서류함은 서류별 상태를 보여 주는 화면이라서, 못 받으면 체크리스트에 붙은 서류 안내로 대신 그린다
        call<ApiDocuments>("/documents").catch(() => null),
      ]);
      return { store, dashboard, report, checklist, alerts: alerts.items, obligations: obligations.items, documents };
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
    /** 법령 개정 등으로 표시된 "다시 확인" 안내를 확인했다고 알린다 */
    ackTaskReview: (itemId: string) => call<unknown>(`/checklist/${itemId}`, "PATCH", { review_ack: true }),
    /** 서류 상태를 바꾼다 (발급·취득 완료와 제출 완료는 다른 상태다) */
    setDocumentStatus: (docKey: string, status: ApiDocumentStatus) =>
      call<ApiDocumentRequirement>(`/documents/${docKey}`, "PATCH", { status }),
    ackDocumentReview: (docKey: string) =>
      call<ApiDocumentRequirement>(`/documents/${docKey}`, "PATCH", { review_ack: true }),
    uploadDocument: (docKey: string, file: File) =>
      apiUpload<ApiDocumentRequirement>(`${base}/documents/${docKey}/files`, file, session.token),
    deleteDocumentFile: (docKey: string, fileId: string) =>
      call<ApiDocumentRequirement>(`/documents/${docKey}/files/${fileId}`, "DELETE"),
    downloadDocumentFile: (docKey: string, fileId: string) =>
      apiDownload(`${base}/documents/${docKey}/files/${fileId}`, session.token),
    readAlert: (alertId: string) => call<unknown>(`/alerts/${alertId}`, "PATCH", { read: true }),
    /** 가게 정보 수정. dryRun 이면 저장하지 않고 영향(impacts·reset_items)만 돌려준다. 미리보기와 저장은 같은 본문을 쓴다. */
    patchStore: (body: Record<string, unknown>, dryRun = false) =>
      call<ApiPatchResult>(dryRun ? "?dry_run=true" : "", "PATCH", body),
    changes: () => call<{ items: ApiChangeLog[] }>("/changes"),
    saveAnswers: (answers: Record<string, unknown>) => call<unknown>("/answers", "POST", { answers }),
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
      apiFetch<{ store_id: string }>("/api/stores", { method: "POST", body, token: session.token }),
  };
}
