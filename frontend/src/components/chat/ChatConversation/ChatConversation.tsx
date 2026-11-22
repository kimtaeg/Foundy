"use client";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatProcessing } from "@/components/chat/ChatProcessing";
import { ChatWelcome } from "@/components/chat/ChatWelcome";
import { FavoriteQuestions } from "@/components/chat/FavoriteQuestions";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import {
  type CallGuide,
  type ChatMessageModel,
  type ChatProcessing as ChatProcessingModel,
  type ConsultationCard,
} from "@/types/chat";
import type { Contact } from "@/types/contact";
import { Suspense, useEffect, useRef, useState } from "react";
export interface ChatConversationProps {
  storeName: string;
  undecided: boolean;
  messages: ChatMessageModel[];
  busy: boolean;
  request: ChatProcessingModel | null;
  cards: ConsultationCard[];
  contacts: Record<string, Contact>;
  actionLabels: Record<string, string>;
  callGuides: Record<string, CallGuide>;
  memo: Record<string, string>;
}
export function ChatConversation({
  storeName,
  undecided,
  messages,
  busy,
  request,
  cards,
  contacts,
  actionLabels,
  callGuides,
  memo,
}: ChatConversationProps) {
  const box = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [unread, setUnread] = useState(false);
  const latest = messages.at(-1);

  useEffect(() => {
    if (!box.current) return;
    if (following.current || latest?.role === "u") {
      box.current.scrollTop = box.current.scrollHeight;
      following.current = true;
      setUnread(false);
    } else if (latest?.role === "a") {
      setUnread(true);
    }
  }, [messages.length, busy, latest]);

  const announcement = busy
    ? "답변을 준비하고 있어요."
    : latest?.processing?.status === "canceled"
      ? "답변 생성을 중지했어요."
      : latest?.processing?.status === "error"
        ? "답변을 준비하지 못했어요. 다시 시도할 수 있어요."
        : latest?.role === "a"
          ? "답변이 도착했어요."
          : "";
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={box}
        className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 [overflow-wrap:anywhere] sm:px-5"
        id="chatBox"
        role="region"
        aria-label="상담 대화"
        tabIndex={0}
        onScroll={() => {
          if (!box.current) return;
          following.current =
            box.current.scrollHeight - box.current.scrollTop - box.current.clientHeight < 64;
          if (following.current) setUnread(false);
        }}
      >
        {messages.length === 0 && (
          <div className="space-y-5 py-3">
            <ChatWelcome storeName={storeName} undecided={undecided} />
            <FavoriteQuestions busy={busy} />
          </div>
        )}
        {messages.map((message, index) => (
          <Suspense key={index} fallback={<SectionSkeleton variant="text" rows={3} label="답변 내용을 불러오는 중" />}>
            <ChatMessage
              message={message}
              index={index}
              last={index === messages.length - 1}
              busy={busy}
              cards={cards}
              contacts={contacts}
              actionLabels={actionLabels}
              callGuides={callGuides}
              memo={memo}
            />
          </Suspense>
        ))}
        {request && (
          <div className="space-y-3">
            <ChatProcessing processing={request} />
            <SectionSkeleton variant="text" rows={2} />
          </div>
        )}
      </div>
      {unread && (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-solid border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-foundy-primary-ink shadow-sm"
          onClick={() => {
            if (box.current) box.current.scrollTop = box.current.scrollHeight;
            following.current = true;
            setUnread(false);
          }}
        >
          새 답변 보기 ↓
        </button>
      )}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
