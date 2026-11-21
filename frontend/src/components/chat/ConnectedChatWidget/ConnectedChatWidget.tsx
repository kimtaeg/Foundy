"use client";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { useChat } from "@/hooks/useChat";
import { useFoundy } from "@/hooks/useFoundy";

/** Adapts the local demo store to the same props that an API container supplies. */
export function ConnectedChatWidget() {
  const { snapshot, onEvent } = useFoundy();
  const data = useChat();
  return (
    <ChatWidget
      open={snapshot?.chatOpen ?? false}
      onboarded={snapshot?.onboarded ?? false}
      data={data ?? undefined}
      loading={!data}
      onEvent={onEvent}
    />
  );
}
