"use client";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { useFoundy } from "@/hooks/useFoundy";

const NOTICE =
  "점검 결과를 근거로 답하는 AI 상담을 준비하고 있어요. 지금은 점검 리포트와 체크리스트에서 할 일을 확인해 주세요.";

/** AI 상담은 서버 상담 API(POST /api/stores/{id}/chat)를 붙이기 전까지 안내만 보여 준다. */
export function ConnectedChatWidget() {
  const { snapshot, onEvent } = useFoundy();
  return (
    <ChatWidget
      open={snapshot?.chatOpen ?? false}
      onboarded={snapshot?.onboarded ?? false}
      notice={NOTICE}
      onEvent={onEvent}
    />
  );
}
