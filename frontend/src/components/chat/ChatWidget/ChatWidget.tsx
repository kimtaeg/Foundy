"use client";
import { ChatLauncher } from "@/components/chat/ChatLauncher";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { EventBoundary } from "@/components/view/EventBoundary";
import type { ChatViewData } from "@/types/chat";
import type { DataViewProps } from "@/types/data-state";

export interface ChatWidgetProps extends DataViewProps<ChatViewData> {
  open: boolean;
  onboarded: boolean;
  /** 상담을 쓸 수 없을 때 패널에 보여 줄 안내 */
  notice?: string;
}

/** The caller owns chat data and commands; the widget only arranges its views. */
export function ChatWidget({ open, onboarded, notice, onEvent, ...state }: ChatWidgetProps) {
  if (!onboarded) return null;
  return (
    <EventBoundary onEvent={onEvent}>
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-3 sm:right-7 sm:bottom-7">
        {open && <ChatPanel {...state} notice={notice} />}
        <ChatLauncher open={open} />
      </div>
    </EventBoundary>
  );
}
