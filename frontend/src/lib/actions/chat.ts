import { type ActionHandlers } from "@/types/actions";

interface ChatActionContext {
  setChatOpen: (open: boolean | "toggle") => void;
}

/** AI 상담은 서버 상담 API를 붙이기 전까지 비활성이다. 상담 버튼은 "준비 중" 안내 창만 연다. */
export function createChatActions(context: ChatActionContext): ActionHandlers {
  const open = () => {
    context.setChatOpen(true);
    return true;
  };
  return {
    chattoggle: () => {
      context.setChatOpen("toggle");
      return true;
    },
    focuschat: open,
    askchat: open,
  };
}
