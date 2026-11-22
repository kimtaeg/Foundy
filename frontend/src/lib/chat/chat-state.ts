import type { ChatState } from "@/types/chat";

export function createInitialChatState(): ChatState {
  return {
    msgs: [],
    focus: null,
    busy: false,
    draft: "",
    memo: {},
    request: null,
  };
}
