/** 상담 API 메시지 → 상담 화면 메시지. */
import type { ApiChatMessage } from "@/lib/api/chat";
import type { ChatMessageModel, ChatProcessing } from "@/types/chat";

export function toChatMessage(message: ApiChatMessage, processing?: ChatProcessing): ChatMessageModel {
  if (message.role === "user") return { role: "u", text: message.content };
  return {
    role: "a",
    // 출처 번호([S1])는 아래 근거 목록으로 보여 주므로 본문에서는 뺀다
    text: stripRefs(message.content),
    cites: message.citations.map((c) => ({ label: c.title, url: c.url, p: c.url ? undefined : PAGE_OF[c.source_type] })),
    acts: message.actions.map((a) => ({ type: "navigate", label: a.label, payload: { p: a.target }, summary: [] })),
    processing,
  };
}

export function stripRefs(text: string): string {
  return text.replace(/\s?\[S\d+\]/g, "");
}

/** 출처 종류 → 열어 볼 화면 (외부 링크가 없을 때) */
const PAGE_OF: Record<string, string | undefined> = {
  checklist: "checklist",
  document: "docs",
  report: "report",
  grant: "grants",
  profile: "mypage",
};
