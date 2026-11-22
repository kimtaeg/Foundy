import type { ReportCardModel } from "@/types/report";

export type ReportFollowUpProps = { model: ReportCardModel };

export function ReportFollowUp({ model }: ReportFollowUpProps) {
  const { card, action, state, contact } = model;
  if (!action || (card.options.length > 0 && !state.chosen)) return null;
  const done = state.action === "done";

  return (
    <section className="grid min-w-0 gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="m-0 text-sm font-semibold text-neutral-600">{done ? "완료한 작업" : "다음 할 일"}</h4>
        <span className="shrink-0 text-sm tabular-nums text-neutral-600">{action.min}분</span>
      </div>
      {done ? (
        <p className="m-0 flex items-center gap-2 rounded-lg bg-foundy-primary/10 px-3 py-2.5 text-base font-semibold leading-6 text-foundy-primary-ink">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m5 12 4 4 10-10" /></svg>
          <span className="break-keep [overflow-wrap:anywhere]">{action.text}</span>
        </p>
      ) : (
        <p className="m-0 break-keep text-base font-semibold leading-6 text-neutral-900 [overflow-wrap:anywhere]">{action.text}</p>
      )}
      {!done && action.type === "send" && contact && <p className="m-0 text-sm leading-6 text-neutral-600">담당 기관 · {contact.name}</p>}
      {!done && action.go && (
        <button type="button" data-nx="go" data-p={action.go.page}
          className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-0 text-sm font-semibold text-foundy-primary-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary">
          {action.go.label} <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  );
}
