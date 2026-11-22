"use client";

import { ChatSubmitButton } from "@/components/chat/ChatSubmitButton";
import { useId, useLayoutEffect, useRef } from "react";

export interface ChatComposerProps {
  draft: string;
  busy: boolean;
}

export function ChatComposer({
  draft,
  busy,
}: ChatComposerProps) {
  const input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const helpId = useId();

  useLayoutEffect(() => {
    const textarea = input.current;
    if (!textarea) return;
    if (textarea.value !== draft) textarea.value = draft;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [draft]);

  return (
    <form
      id="nxChat"
      className="shrink-0 rounded-3xl border border-solid border-neutral-200 bg-white p-3 transition-colors focus-within:border-foundy-primary motion-reduce:transition-none"
      onSubmit={(event) => {
        if (busy || !input.current?.value.trim()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <textarea
        ref={input}
        id="chatIn"
        rows={2}
        maxLength={300}
        autoComplete="off"
        required
        placeholder="내 가게에 대해 물어보세요"
        aria-label="질문 입력"
        aria-describedby={helpId}
        defaultValue={draft}
        className="block max-h-[120px] min-h-14 w-full resize-none border-0 bg-transparent px-1 py-1 text-base leading-6 text-neutral-900 outline-none placeholder:text-neutral-600 focus-visible:outline-none"
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onKeyDown={(event) => {
          if (
            event.key !== "Enter" ||
            event.shiftKey ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            composing.current ||
            event.nativeEvent.isComposing ||
            event.nativeEvent.keyCode === 229
          )
            return;
          event.preventDefault();
          if (!busy && event.currentTarget.value.trim())
            event.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-600">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="size-3.5 shrink-0 text-foundy-primary"
          >
            <path
              d="M10 2.5 11.8 8.2 17.5 10l-5.7 1.8-1.8 5.7-1.8-5.7L2.5 10l5.7-1.8L10 2.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          내 가게 기준
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {draft.length >= 250 && (
            <span className="text-xs tabular-nums text-neutral-600">
              {draft.length}/300
            </span>
          )}
          <ChatSubmitButton busy={busy} disabled={!draft.trim()} />
        </div>
      </div>
    </form>
  );
}
