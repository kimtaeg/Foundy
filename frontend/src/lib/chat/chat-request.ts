import type {
  ChatMessageModel,
  ChatProcessing,
  ChatProcessingStep,
  ChatState,
} from "@/types/chat";

interface Dependencies {
  getState: () => ChatState;
  reply: (question: string, focus: string | null) => ChatMessageModel;
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancelTimer: (timer: ReturnType<typeof setTimeout>) => void;
  now?: () => number;
}

/** Describes returned content, never simulated reasoning or unperformed API work. */
function completedSteps(message: ChatMessageModel): ChatProcessingStep[] {
  const steps: ChatProcessingStep[] = [
    { id: "question", label: "질문 확인" },
  ];
  const citations = message.cites?.length ?? 0;
  if (citations)
    steps.push({
      id: "references",
      label: "관련 안내 연결",
      detail: `답변에 관련 안내 ${citations}건을 함께 담았어요.`,
    });
  if (message.call || message.contacts?.length)
    steps.push({
      id: "contacts",
      label: "문의 준비 정보 정리",
      detail: message.call
        ? "담당 기관에 문의할 순서와 질문을 준비했어요."
        : "직접 확인할 수 있는 담당 기관 연락처를 정리했어요.",
    });
  const changes = message.acts?.filter((action) => action.type !== "navigate").length ?? 0;
  if (changes)
    steps.push({
      id: "changes",
      label: "변경 제안 준비",
      detail: `${changes}건의 제안을 준비했어요. 적용 여부는 아래에서 확인할 수 있어요.`,
    });
  steps.push({
    id: "answer",
    label: "답변 준비 완료",
    detail: message.kind === "oos"
      ? "현재 안내할 수 있는 범위와 추가 확인이 필요한 내용을 정리했어요."
      : "질문에 맞는 안내를 정리했어요.",
  });
  return steps;
}

/** Owns one request without canceling unrelated application work. */
export function createChatRequest({
  getState,
  reply,
  schedule,
  cancelTimer,
  now = Date.now,
}: Dependencies) {
  let pending: {
    state: ChatState;
    processing: ChatProcessing;
    timer?: ReturnType<typeof setTimeout>;
  } | null = null;

  function send(question: string, requestFocus?: string | null) {
    const state = getState();
    const text = String(question || "").trim().slice(0, 300);
    if (!text || state.busy) return;
    if (pending?.timer !== undefined) cancelTimer(pending.timer);
    const focus = requestFocus === undefined ? state.focus : requestFocus;
    const processing: ChatProcessing = {
      status: "processing",
      question: text,
      focus,
      startedAt: now(),
      steps: [{ id: "question", label: "질문 접수" }],
    };
    state.msgs.push({ role: "u", text });
    state.draft = "";
    state.busy = true;
    state.request = processing;
    const job: NonNullable<typeof pending> = { state, processing };
    pending = job;
    job.timer = schedule(() => {
      if (pending !== job || getState() !== state || state.request !== processing)
        return;
      try {
        const message = reply(text, focus);
        state.msgs.push({
          ...message,
          processing: {
            ...processing,
            status: "completed",
            finishedAt: now(),
            steps: completedSteps(message),
          },
        });
      } catch {
        state.msgs.push({
          role: "a",
          kind: "status",
          text: "답변을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.",
          processing: {
            ...processing,
            status: "error",
            finishedAt: now(),
            steps: [{ id: "question", label: "질문 접수" }],
          },
        });
      } finally {
        state.busy = false;
        state.request = null;
        if (pending === job) pending = null;
      }
    }, 420);
  }

  function stop() {
    const job = pending;
    if (!job || getState() !== job.state || job.state.request !== job.processing)
      return;
    if (job.timer !== undefined) cancelTimer(job.timer);
    pending = null;
    job.state.busy = false;
    job.state.request = null;
    job.state.msgs.push({
      role: "a",
      kind: "status",
      text: "답변 준비를 중단했어요. 원하면 다시 시도할 수 있어요.",
      processing: {
        ...job.processing,
        status: "canceled",
        finishedAt: now(),
        steps: [{ id: "question", label: "질문 접수" }],
      },
    });
  }

  function retry(messageIndex: number) {
    const processing = getState().msgs[messageIndex]?.processing;
    if (processing?.status === "error" || processing?.status === "canceled")
      send(processing.question, processing.focus);
  }

  return { send, stop, retry };
}
