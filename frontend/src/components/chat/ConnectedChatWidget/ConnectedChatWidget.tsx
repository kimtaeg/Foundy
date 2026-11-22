"use client";

import { ChatWidget } from "@/components/chat/ChatWidget";
import { useChat } from "@/hooks/useChat";
import { useFoundy } from "@/hooks/useFoundy";
import { useServerChat } from "@/hooks/useServerChat";
import { loadSession, sessionSnapshot, subscribeSession, type ApiSession } from "@/lib/api/foundy-api";
import type { ViewEventHandler } from "@/types/events";
import { useSyncExternalStore } from "react";

export function ConnectedChatWidget() {
  const { apiActive, snapshot, onEvent } = useFoundy();
  if (apiActive) return <ApiChatWidget />;
  if (!snapshot?.onboarded) return null;
  return <LocalChatWidget open={snapshot.chatOpen} onEvent={onEvent} />;
}

function LocalChatWidget({ open, onEvent }: { open: boolean; onEvent: ViewEventHandler }) {
  const data = useChat();
  return <ChatWidget open={open} onboarded data={data ?? undefined} loading={!data} onEvent={onEvent} />;
}

const readServerSession = () => null;

function ApiChatWidget() {
  const { snapshot, onEvent } = useFoundy();
  useSyncExternalStore(subscribeSession, sessionSnapshot, readServerSession);
  const session = loadSession();
  if (!snapshot?.onboarded) return null;
  if (!session?.storeId) {
    return <ChatWidget open={snapshot.chatOpen} onboarded error="가게에 연결하지 못했어요. 다시 로그인해 주세요." onEvent={onEvent} />;
  }
  return <ServerChatWidget key={`${session.token}:${session.storeId}`} session={{ ...session, storeId: session.storeId }} />;
}

function ServerChatWidget({ session }: { session: ApiSession & { storeId: string } }) {
  const { snapshot, chatLaunch, onEvent } = useFoundy();
  const open = snapshot?.chatOpen ?? false;
  const chat = useServerChat(session, open, snapshot?.storeName || "내 가게", chatLaunch);

  return (
    <ChatWidget
      open={open}
      onboarded
      data={chat.data}
      error={chat.error}
      loading={chat.loading}
      onRetry={chat.retry}
      onEvent={(type, event) => {
        if (!chat.handleEvent(type, event)) onEvent(type, event);
      }}
    />
  );
}
