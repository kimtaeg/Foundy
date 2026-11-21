import { type ActionHandlers } from "@/types/actions";
import { type ChatContext, type ChatMessageModel } from "@/types/chat";
import { type ReportCardData, type ReportState } from "@/types/report";

type SavedReportState = Omit<ReportState, "chosen"> & {
  chosen?: string | null;
};
type AssistantMessageInput = Omit<Partial<ChatMessageModel>, "acts"> & {
  acts?: Array<{
    type: "navigate";
    label: string;
    payload: { p: string; focus?: string };
  }>;
};

interface ChatActionContext {
  CH: ChatContext["CH"];
  setChatOpen: (open: boolean | "toggle") => void;
  goto: (page: string) => void;
  sendChat: (question: string) => void;
  stopChat: () => void;
  retryChat: (messageIndex: number) => void;
  applyAct: (messageIndex: number, actionIndex: number) => void;
  buildCards: () => ReportCardData[];
  RS: Record<string, SavedReportState>;
  put: (key: string, value: unknown) => void;
  A: (message: AssistantMessageInput) => ChatMessageModel;
  logNext: (cardId: string, status: "sent") => void;
  toast: (message: string) => void;
}

/** Commands emitted by chat views; view layout is deliberately absent. */
export function createChatActions(context: ChatActionContext): ActionHandlers {
  return {
    chattoggle: () => {
      context.setChatOpen("toggle");
      return true;
    },
    focuschat: (button) => {
      context.CH.focus = button.dataset.id ?? "";
      context.setChatOpen(true);
      return true;
    },
    askchat: (button) => {
      context.CH.focus = null;
      context.setChatOpen(true);
      context.sendChat(button.dataset.q ?? "");
      return true;
    },
    cask: (button) => {
      context.sendChat(button.dataset.q ?? "");
      return true;
    },
    cstop: () => {
      context.stopChat();
      return true;
    },
    cretry: (button) => {
      context.retryChat(Number(button.dataset.m));
      return true;
    },
    cfocus: (button) => {
      context.CH.focus = button.dataset.id || null;
      return true;
    },
    cact: (button) => {
      context.applyAct(Number(button.dataset.m), Number(button.dataset.a));
      return true;
    },
    ccancel: (button) => {
      const action =
        context.CH.msgs[Number(button.dataset.m)]?.acts?.[
          Number(button.dataset.a)
        ];
      if (action && !action.state) action.state = "canceled";
      return true;
    },
    callsave: (button) => {
      const id = button.dataset.id ?? "";
      const card = context.buildCards().find((item) => item.id === id);
      if (!card) return;
      const memo = context.CH.memo[id] || "";
      const awaitingChoice = card.options.length > 0 && !context.RS[id]?.chosen;
      if (awaitingChoice) {
        context.RS[id] = {
          chosen: null,
          action: "pending",
          ...context.RS[id],
          reply: memo,
        };
        context.put("rs", context.RS);
        context.CH.msgs.push(
          context.A({
            kind: "chitchat",
            text: "통화 메모를 저장했어요. 이 카드는 선택지를 먼저 고르면 “문의했어요”로 이어서 기록할 수 있어요.",
            acts: [
              {
                type: "navigate",
                label: "카드 열기",
                payload: { p: "report", focus: id },
              },
            ],
          }),
        );
      } else {
        context.RS[id] = {
          chosen: null,
          ...context.RS[id],
          action: "sent",
          reply: memo,
        };
        context.put("rs", context.RS);
        context.logNext(id, "sent");
        context.CH.msgs.push(
          context.A({
            kind: "chitchat",
            text: "통화 결과를 카드에 “문의했어요(답변 대기)”로 기록했어요. 답변을 받으면 카드에서 완료로 바꾸세요.",
            acts: [
              {
                type: "navigate",
                label: "카드 열기",
                payload: { p: "report", focus: id },
              },
            ],
          }),
        );
      }
      context.toast("통화 결과를 기록했어요");
      return true;
    },
  };
}
