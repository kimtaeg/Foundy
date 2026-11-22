export interface OptionConfirmDialogProps {
  cardId: string;
  optionId: string;
  label: string;
  summary: string;
  changes: string[];
  recommended: boolean;
  reason?: string;
  meta: string;
}

export function OptionConfirmDialog({
  label, summary, changes, recommended, reason, meta,
}: OptionConfirmDialogProps) {
  return (
    <div className="grid min-w-0 gap-5 break-keep [overflow-wrap:anywhere]">
      <div className="grid min-w-0 gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="m-0 min-w-0 text-lg font-semibold leading-snug tracking-tight text-neutral-900">{label}</h3>
          {recommended && <span className="shrink-0 rounded-full bg-foundy-primary/10 px-2 py-0.5 text-[13px] font-semibold leading-5 text-foundy-primary-ink">추천</span>}
        </div>
        {summary && <p className="m-0 text-sm leading-relaxed text-neutral-700">{summary}</p>}
        {meta && <p className="m-0 text-[13px] leading-5 text-neutral-600">{meta}</p>}
      </div>
      {reason && (
        <section className="grid gap-1.5 rounded-xl bg-foundy-primary/5 p-4">
          <h3 className="m-0 text-sm font-semibold leading-5 text-foundy-primary-ink">추천하는 이유</h3>
          <p className="m-0 text-sm leading-relaxed text-neutral-700">{reason}</p>
        </section>
      )}
      {changes.length > 0 && (
        <section className="grid gap-2 border-0 border-t border-solid border-neutral-200 pt-4">
          <h3 className="m-0 text-base font-semibold leading-6 text-neutral-900">적용하면 이렇게 바뀌어요</h3>
          <ul className="m-0 grid list-disc gap-1.5 pl-5 text-sm leading-relaxed text-neutral-700 marker:text-neutral-400">
            {changes.map((change) => <li key={change}>{change}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
