"use client";

import { ChatProcessingStep } from "@/components/chat/ChatProcessingStep";
import { useChatElapsed } from "@/hooks/useChatElapsed";
import type { ChatAction, ChatProcessing as Processing } from "@/types/chat";
import { useId, useState } from "react";

export interface ChatProcessingProps {
  processing: Processing;
  actions?: ChatAction[];
  messageIndex?: number;
}

export function ChatProcessing({ processing, actions = [], messageIndex }: ChatProcessingProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const headingId = useId();
  const elapsed = useChatElapsed(processing.startedAt, processing.finishedAt);
  const running = processing.status === "processing";
  const failed = processing.status === "error";
  const stopped = processing.status === "canceled";
  const title = running
    ? "답변 준비 중"
    : failed
      ? "답변을 준비하지 못했어요"
      : stopped
        ? "처리를 중지했어요"
        : "처리 완료";
  const steps: Array<{
    id: string;
    label: string;
    detail?: string;
    state: "complete" | "active" | "waiting" | "muted" | "error";
  }> = processing.steps.map((step) => ({ ...step, state: "complete" }));

  if (running)
    steps.push({ id: "preparing", label: "답변 준비 중", state: "active" });
  if (stopped || failed)
    steps.push({
      id: processing.status,
      label: failed ? "답변 준비 실패" : "요청 중지",
      detail: "같은 질문으로 다시 요청할 수 있어요.",
      state: failed ? "error" : "muted",
    });
  for (const [index, action] of actions.entries()) {
    if (action.type === "navigate") continue;
    const applied = action.state === "applied";
    const canceled = action.state === "canceled";
    steps.push({
      id: `action-${index}`,
      label: `${applied ? "적용 완료" : canceled ? "제안 취소" : "확인 대기"} · ${action.label}`,
      detail: applied
        ? action.result?.join("\n")
        : canceled
          ? "이 제안으로 변경된 내용은 없어요."
          : "아래 제안을 확인하고 적용하면 반영돼요.",
      state: applied ? "complete" : canceled ? "muted" : "waiting",
    });
  }

  return (
    <div className="min-w-0" data-chat-processing={processing.status}>
      <button
        id={headingId}
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className="flex max-w-full items-center gap-2 rounded-lg border-0 bg-transparent px-1 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`size-4 shrink-0 ${failed ? "text-red-700" : "text-foundy-primary-ink"} ${running ? "motion-safe:animate-pulse" : ""}`}
        >
          {processing.status === "completed" ? (
            <path
              d="m4 10 4 4 8-8"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d="M10 2.5 11.8 8.2 17.5 10l-5.7 1.8-1.8 5.7-1.8-5.7L2.5 10l5.7-1.8L10 2.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          )}
        </svg>
        <span className="min-w-0 font-medium leading-5">{title}</span>
        <span className="shrink-0 text-xs tabular-nums text-neutral-600" aria-hidden="true">
          {elapsed < 1 && !running ? "1초 미만" : `${Math.floor(elapsed)}초`}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className={`ml-auto size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
        >
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={contentId} role="region" aria-labelledby={headingId} hidden={!expanded}>
        <ol className="mb-3 ml-1 mt-2 list-none border-0 border-b border-solid border-neutral-100 p-0 pb-4">
          {steps.map((step, index) => (
            <ChatProcessingStep key={step.id} {...step} last={index === steps.length - 1} />
          ))}
        </ol>
      </div>
      {(stopped || failed) && messageIndex !== undefined && (
        <button
          type="button"
          data-nx="cretry"
          data-m={messageIndex}
          className="mt-2 rounded-xl border border-solid border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary"
        >
          다시 요청
        </button>
      )}
    </div>
  );
}
