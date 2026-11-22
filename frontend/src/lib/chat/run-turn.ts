import { ApiError } from "@/lib/api/client";
import type { ApiChatMessage, createChatApi } from "@/lib/api/chat";
import { serverQuestion, stripRefs, toChatMessage } from "@/lib/chat/server-message";
import type { ChatFocus, ChatMessageModel, ChatProcessing } from "@/types/chat";

const failedMessage = "지금은 답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요.";

export interface ChatQuestion {
  text: string;
  focus?: ChatFocus;
}

interface TurnOptions {
  sessionId: string | null;
  storeId: string;
  question: ChatQuestion;
  signal: AbortSignal;
}

function isAssistantReply(value: unknown): value is ApiChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ApiChatMessage>;
  return message.role === "assistant" && typeof message.content === "string" &&
    Array.isArray(message.actions) && Array.isArray(message.citations);
}

interface TurnCallbacks {
  onSession(id: string): void;
  onProgress(processing: ChatProcessing, partial: string): void;
  onFinish(message: ChatMessageModel): void;
}

/** Translates one server stream into the in-progress and final chat messages. */
export async function runChatTurn(api: ReturnType<typeof createChatApi>, options: TurnOptions, callbacks: TurnCallbacks) {
  const { sessionId, storeId, question, signal } = options;
  let processing: ChatProcessing = {
    status: "processing",
    question: question.text,
    focus: question.focus?.id ?? null,
    startedAt: Date.now(),
    steps: [],
  };
  let partial = "";
  let finished = false;
  const finish = (status: ChatProcessing["status"], text?: string, reply?: ApiChatMessage) => {
    if (finished) return;
    const final = { ...processing, status, finishedAt: Date.now() };
    const message = reply
      ? toChatMessage({ ...reply, content: text ?? reply.content }, final)
      : { role: "a", text: text ?? failedMessage, processing: final };
    finished = true;
    callbacks.onFinish(message);
  };

  callbacks.onProgress(processing, "");
  try {
    const id = sessionId ?? (await api.create(storeId)).session_id;
    if (!sessionId) callbacks.onSession(id);
    signal.throwIfAborted();
    await api.send(id, serverQuestion(question.text, question.focus), (event, raw) => {
      if (finished || !raw || typeof raw !== "object") return;
      const data = raw as Record<string, unknown>;
      switch (event) {
        case "tool": {
          if (typeof data.label !== "string") break;
          const step = {
            id: `tool-${processing.steps.length}`,
            label: data.label,
            detail: data.status === "failed" ? "조회하지 못했어요" : undefined,
          };
          processing = { ...processing, steps: [...processing.steps, step] };
          callbacks.onProgress(processing, stripRefs(partial));
          break;
        }
        case "delta":
          if (typeof data.text !== "string") break;
          partial += data.text;
          callbacks.onProgress(processing, stripRefs(partial));
          break;
        case "reset":
          partial = "";
          callbacks.onProgress(processing, "");
          break;
        case "done":
          if (isAssistantReply(raw)) finish("completed", undefined, raw);
          break;
        case "error":
          finish(
            "error",
            typeof data.message === "string" && data.message.trim() ? data.message : undefined,
            isAssistantReply(data.reply) ? data.reply : undefined,
          );
          break;
      }
    }, signal);
    finish("error", failedMessage);
  } catch (error) {
    if (signal.aborted) finish("canceled", stripRefs(partial) || "답변 생성을 중지했어요.");
    else finish("error", error instanceof ApiError ? error.message : failedMessage);
  }
}
