import type { ApiChatMessage } from "@/lib/api/chat";
import { isFeaturePage } from "@/lib/routes";
import type { ChatFocus, ChatMessageModel, ChatProcessing } from "@/types/chat";

const citationPages: Record<string, string | undefined> = {
  checklist: "checklist",
  document: "docs",
  report: "report",
  grant: "grants",
  profile: "mypage",
};

const focusSeparator = "\n\n점검 리포트 항목: ";

export function serverQuestion(question: string, focus?: ChatFocus) {
  if (!focus) return question;
  const context = focus.title.replace(/\s+/g, " ").trim();
  return (question + focusSeparator + context).slice(0, 1000);
}

export function stripRefs(text: string) {
  return text.replace(/[ \t]?\[S\d+\]/g, "");
}

function externalUrl(url: string | null) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
  } catch {
    return undefined;
  }
  return undefined;
}

export function toChatMessage(message: ApiChatMessage, processing?: ChatProcessing): ChatMessageModel {
  if (message.role === "user") return { role: "u", text: message.content.split(focusSeparator)[0] };
  return {
    role: "a",
    text: stripRefs(message.content),
    cites: message.citations.map((source) => {
      const url = externalUrl(source.url);
      return {
        label: source.title,
        url,
        p: url ? undefined : citationPages[source.source_type],
        focus: source.source_type === "report" ? source.source_id ?? undefined : undefined,
      };
    }),
    acts: message.actions.flatMap((action) => (
      action.type === "navigate" && isFeaturePage(action.target)
        ? [{ type: "navigate", label: action.label, payload: { p: action.target }, summary: [] }]
        : []
    )),
    processing,
  };
}
