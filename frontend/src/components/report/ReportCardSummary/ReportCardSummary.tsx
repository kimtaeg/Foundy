import { VerdictBadge } from "@/components/report/VerdictBadge";
import { Element } from "@/components/view/Element";
import {
  type ReportCardData,
  type ReportState,
  type Verdict,
} from "@/types/report";

/** 접힌 상태에서도 보이는 한 줄: 판정, 제목, 안 하면 생기는 일, 결정 상태. */
export type ReportCardSummaryProps = {
  card: ReportCardData;
  state: ReportState;
  verdict: Verdict;
  followUpPending: boolean;
  status: string;
};

export function ReportCardSummary({
  card,
  state,
  verdict,
  followUpPending,
  status,
}: ReportCardSummaryProps) {
  const selected = card.options.find((option) => option.id === state.chosen);
  const resolved =
    selected?.fx.resolved && verdict !== card.base
      ? selected.fx.resolved
      : null;
  return (
    <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
      <div className="min-w-0 flex-1">
        <Element className="nx-badges">
          {followUpPending ? (
            <Element as="span" className="nx-badge low">
              결정함 · 할 일 남음
            </Element>
          ) : (
            <VerdictBadge verdict={verdict} />
          )}
          <Element as="span" className="nx-muted">
            {card.stage}
          </Element>
        </Element>
        <h3>{(!followUpPending && resolved) || card.title}</h3>
        {card.consequence && verdict !== "ok" && !selected && (
          <Element className="nx-muted">안 하면 · {card.consequence}</Element>
        )}
      </div>
      <Element
        as="span"
        className="mt-1 flex shrink-0 items-center gap-1.5 text-sm font-bold text-foundy-primary"
      >
        {status}
        <span
          aria-hidden="true"
          className="transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </Element>
    </summary>
  );
}
