"use client";
import { ChatLauncher } from "@/components/chat/ChatLauncher";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { EventBoundary } from "@/components/view/EventBoundary";
import type { ChatViewData } from "@/types/chat";
import type { DataViewProps } from "@/types/data-state";

export interface ChatWidgetProps extends DataViewProps<ChatViewData> {
  open: boolean;
  onboarded: boolean;
}

/** The caller owns chat data and commands; the widget only arranges its views. */
export function ChatWidget({ open, onboarded, onEvent, ...state }: ChatWidgetProps) {
  if (!onboarded) return null;
  return (
    <EventBoundary onEvent={onEvent}>
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-3 sm:right-7 sm:bottom-7">
        {open && <ChatPanel {...state} />}
        <ChatLauncher open={open} />
      </div>
    </EventBoundary>
  );
}
