/** AI 상담 API (/api/chat/sessions). 메시지 전송은 SSE 스트림으로 답을 받는다. */
import { apiFetch } from "@/lib/api/client";
import { readEventStream, type SseHandler } from "@/lib/api/sse";

export interface ApiChatCitation {
  source_type: "law" | "checklist" | "document" | "report" | "grant" | "profile" | string;
  source_id: string | null;
  title: string;
  url: string | null;
  article: string | null;
}
export interface ApiChatMessage {
  message_id: string;
  role: "user" | "assistant";
  content: string;
  actions: Array<{ type: "navigate"; target: string; label: string }>;
  citations: ApiChatCitation[];
  created_at: string;
}
export interface ApiChatSession {
  session_id: string;
  store_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export function createChatApi(token: string) {
  const base = "/api/chat/sessions";
  return {
    list: (storeId: string, includeMessages = false) =>
      apiFetch<{ items: ApiChatSession[]; messages?: ApiChatMessage[] }>(
        `${base}?store_id=${encodeURIComponent(storeId)}${includeMessages ? "&include_messages=true" : ""}`, { token },
      ),
    create: (storeId: string) => apiFetch<ApiChatSession>(base, { method: "POST", body: { store_id: storeId }, token }),
    messages: (sessionId: string) =>
      apiFetch<{ session: ApiChatSession; items: ApiChatMessage[] }>(`${base}/${sessionId}/messages`, { token }),
    remove: (sessionId: string) => apiFetch<unknown>(`${base}/${sessionId}`, { method: "DELETE", token }),
    /** 질문을 보내고 tool · delta · reset · done · error 이벤트를 받는다 */
    send: (sessionId: string, content: string, onEvent: SseHandler, signal?: AbortSignal) =>
      readEventStream(`${base}/${sessionId}/messages`, token, onEvent, { method: "POST", body: { content }, signal }),
  };
}
