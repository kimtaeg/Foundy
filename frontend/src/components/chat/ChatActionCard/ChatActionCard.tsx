import { type ChatAction } from "@/types/chat";

export interface ChatActionCardProps {
  action: ChatAction;
  messageIndex: number;
  actionIndex: number;
  typeLabel?: string;
}

export function ChatActionCard({
  action,
  messageIndex,
  actionIndex,
  typeLabel,
}: ChatActionCardProps) {
  if (action.type === "navigate")
    return (
      <button
        type="button"
        className="flex max-w-full items-center gap-2 rounded-xl border border-solid border-neutral-200 bg-white px-3 py-2 text-left text-sm font-medium text-neutral-800 transition-colors hover:border-foundy-primary hover:text-foundy-primary-ink"
        data-nx="cnav"
        data-p={action.payload.p}
        data-focus={action.payload.focus || ""}
      >
        <span className="min-w-0 [overflow-wrap:anywhere]">{action.label}</span>
        <span aria-hidden="true" className="shrink-0">↗</span>
      </button>
    );

  const applied = action.state === "applied";
  const canceled = action.state === "canceled";

  return (
    <section
      aria-label={action.label}
      className="rounded-2xl border border-solid border-neutral-200 bg-neutral-50 p-4 text-sm leading-6"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-neutral-600">{typeLabel || "변경 제안"}</span>
        <span className={`rounded-md bg-white px-2 py-0.5 text-xs font-medium ${applied ? "text-foundy-primary-ink" : "text-neutral-600"}`}>
          {applied ? "적용 완료" : canceled ? "취소됨" : "확인 대기"}
        </span>
      </div>
      <h3 className="m-0 text-sm font-semibold text-neutral-900">{action.label}</h3>
      <ul className="mb-3 mt-2 space-y-1 pl-5 text-neutral-700">
        {(action.summary || []).map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
      {applied ? (
        <div className="border-0 border-t border-solid border-neutral-200 pt-3">
          <p className="m-0 font-medium text-foundy-primary-ink">✓ 적용했어요</p>
          {!!action.result?.length && (
            <ul className="mb-0 mt-1 space-y-1 pl-5 text-neutral-600">
              {action.result.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          )}
        </div>
      ) : canceled ? (
        <p className="m-0 text-neutral-600">취소했어요. 아무것도 바뀌지 않았어요.</p>
      ) : (
        <>
          <p className="m-0 text-neutral-600">확인한 뒤에 가게 정보에 반영해요.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-10 rounded-xl border-0 bg-foundy-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-foundy-primary-ink"
              data-nx="cact"
              data-m={messageIndex}
              data-a={actionIndex}
            >
              확인하고 적용
            </button>
            <button
              type="button"
              className="min-h-10 rounded-xl border border-solid border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              data-nx="ccancel"
              data-m={messageIndex}
              data-a={actionIndex}
            >
              취소
            </button>
          </div>
        </>
      )}
    </section>
  );
}
