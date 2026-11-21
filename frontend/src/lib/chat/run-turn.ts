/** 질문 하나를 서버 상담에 보내고 SSE 이벤트를 화면 상태 변화로 바꾼다 (훅 밖의 순수 처리). */
import type { ApiChatMessage, createChatApi } from "@/lib/api/chat";
import { stripRefs, toChatMessage } from "@/lib/chat/server-message";
import type { ChatMessageModel, ChatProcessing } from "@/types/chat";

export const CHAT_FAILED = "지금은 답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요.";

export interface TurnCallbacks {
  /** 상담방을 새로 만들었다 */
  onSession(sessionId: string): void;
  /** 처리 단계(도구 실행) 표시. null 이면 숨긴다 (답변 글자가 오기 시작함) */
  onRequest(processing: ChatProcessing | null): void;
  /** 지금까지 받은 답변 글자 (빈 글이면 진행 중 답변을 지운다) */
  onPartial(message: ChatMessageModel | null): void;
  /** 최종 답변 */
  onFinish(message: ChatMessageModel): void;
}

export async function runChatTurn(
  api: ReturnType<typeof createChatApi>,
  options: { sessionId: string | null; storeId: string; text: string; signal: AbortSignal },
  cb: TurnCallbacks,
): Promise<void> {
  const turn = {
    processing: { status: "processing", question: options.text, focus: null, startedAt: Date.now(), steps: [] } as ChatProcessing,
    partial: "",
    finished: false,
  };
  const end = (status: ChatProcessing["status"]) => ({ ...turn.processing, status, finishedAt: Date.now() });
  const finish = (message: ChatMessageModel) => {
    turn.finished = true;
    cb.onRequest(null);
    cb.onFinish(message);
  };
  cb.onRequest(turn.processing);
  try {
    const id = options.sessionId ?? (await api.create(options.storeId)).session_id;
    if (!options.sessionId) cb.onSession(id);
    await api.send(
      id,
      options.text,
      (event, raw) => {
        const data = (raw ?? {}) as Record<string, unknown>;
        if (event === "tool") {
          const step = {
            id: `${data.name}-${turn.processing.steps.length}`,
            label: String(data.label ?? data.name),
            detail: data.status === "failed" ? "조회하지 못했어요" : undefined,
          };
          turn.processing = { ...turn.processing, steps: [...turn.processing.steps, step] };
          cb.onRequest(turn.processing);
        } else if (event === "delta") {
          turn.partial += String(data.text ?? "");
          cb.onRequest(null);
          cb.onPartial({ role: "a", text: stripRefs(turn.partial), processing: turn.processing });
        } else if (event === "reset") {
          turn.partial = "";
          cb.onPartial(null);
          cb.onRequest(turn.processing);
        } else if (event === "done") {
          finish(toChatMessage(data as unknown as ApiChatMessage, end("completed")));
        } else if (event === "error") {
          finish({ role: "a", text: String(data.message ?? CHAT_FAILED), processing: end("error") });
        }
      },
      options.signal,
    );
    if (!turn.finished) finish({ role: "a", text: CHAT_FAILED, processing: end("error") });
  } catch {
    const canceled = options.signal.aborted;
    finish({
      role: "a",
      text: canceled ? turn.partial || "답변 생성을 중지했어요." : CHAT_FAILED,
      processing: end(canceled ? "canceled" : "error"),
    });
  }
}
