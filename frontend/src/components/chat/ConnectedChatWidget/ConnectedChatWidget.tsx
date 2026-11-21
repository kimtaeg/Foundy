"use client";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { useFoundy } from "@/hooks/useFoundy";
import { useServerChat } from "@/hooks/useServerChat";
import { loadSession } from "@/lib/api/foundy-api";
import type { ViewEventHandler } from "@/types/events";
import { useMemo } from "react";

const NOTICE =
  "AI 상담은 서버에 연결된 계정에서 쓸 수 있어요. 지금은 점검 리포트와 체크리스트에서 할 일을 확인해 주세요.";

/** 서버에 연결된 가게면 AI 상담(도구 호출·법령 검색·출처 표시)을 쓰고, 아니면 안내만 보여 준다. */
export function ConnectedChatWidget() {
  const { snapshot, onEvent, api } = useFoundy();
  const open = snapshot?.chatOpen ?? false;
  const session = useMemo(() => (api ? (loadSession("demo") ?? loadSession("account")) : null), [api]);
  const chat = useServerChat(session?.storeId ? session : null, open, api?.S.name ?? "");
  const handle: ViewEventHandler = (type, event) => {
    if (session && chat.handleEvent(type, event)) return;
    onEvent(type, event);
  };
  return (
    <ChatWidget
      open={open}
      onboarded={snapshot?.onboarded ?? false}
      notice={session ? undefined : NOTICE}
      data={session ? chat.data : undefined}
      loading={chat.loading}
      onEvent={handle}
    />
  );
}
