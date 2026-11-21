"use client";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { PinnedQuestion } from "@/components/chat/PinnedQuestion";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { ChatViewData } from "@/types/chat";
import { Suspense, useEffect, useRef } from "react";

export interface ChatPanelContentProps {
  data: ChatViewData;
}

export function ChatPanelContent({ data }: ChatPanelContentProps) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    content.current
      ?.querySelector<HTMLTextAreaElement>("#chatIn")
      ?.focus({ preventScroll: true });
  }, []);

  return (
    <div ref={content} className="flex min-h-0 flex-1 flex-col">
      {data.focus && (
        <div className="shrink-0 px-4 pt-3">
          <PinnedQuestion {...data.focus} />
        </div>
      )}
      <Suspense fallback={<SectionSkeleton variant="chat" label="상담 내용을 불러오는 중" className="m-4 flex-1" />}>
        <ChatConversation
          storeName={data.storeName}
          undecided={data.undecided}
          messages={data.messages}
          busy={data.busy}
          request={data.request}
          cards={data.cards}
          contacts={data.contacts}
          actionLabels={data.actionLabels}
          callGuides={data.callGuides}
          memo={data.memo}
        />
      </Suspense>
      <footer className="shrink-0 bg-white px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
        <ChatComposer draft={data.draft} busy={data.busy} />
      </footer>
    </div>
  );
}
