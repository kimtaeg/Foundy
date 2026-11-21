"use client";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatPanelContent } from "@/components/chat/ChatPanelContent";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { ChatViewData } from "@/types/chat";
import type { DataState } from "@/types/data-state";
import { useEffect, useRef } from "react";

export type ChatPanelProps = DataState<ChatViewData> & {
  /** 상담을 쓸 수 없을 때 대화 대신 보여 줄 안내 */
  notice?: string;
};

export function ChatPanel({ notice, ...props }: ChatPanelProps) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    return () => {
      document
        .querySelector<HTMLButtonElement>('[aria-controls="chatPanel"]')
        ?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <section
      ref={panel}
      id="chatPanel"
      role="dialog"
      aria-labelledby="chatTitle"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        panel.current
          ?.querySelector<HTMLButtonElement>('[data-nx="chattoggle"]')
          ?.click();
      }}
      className="pointer-events-auto flex h-[min(720px,calc(100dvh-7rem))] w-[min(440px,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-4xl border border-solid border-neutral-200 bg-white shadow-[0_16px_56px_rgba(0,0,0,0.10)] motion-safe:animate-chat-panel-in sm:h-[min(720px,calc(100dvh-8rem))]"
    >
      <ChatHeader />
      {notice ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center" role="status">
          <b className="text-base leading-6 text-neutral-900">AI 상담 준비 중</b>
          <p className="m-0 text-sm leading-6 text-neutral-600">{notice}</p>
        </div>
      ) : (
        <DataBoundary {...props} fallback={<SectionSkeleton variant="chat" label="상담 내용을 불러오는 중" className="m-4 flex-1" />}>
          {(data) => <ChatPanelContent data={data} />}
        </DataBoundary>
      )}
    </section>
  );
}
