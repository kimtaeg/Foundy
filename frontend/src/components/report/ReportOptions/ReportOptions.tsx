import { OptionCard } from "@/components/report/OptionCard";
import { VerdictBadge } from "@/components/report/VerdictBadge";
import { Element } from "@/components/view/Element";
import {
  type ReportCardData,
  type ReportState,
  type Verdict,
} from "@/types/report";

export type ReportOptionsProps = {
  card: ReportCardData;
  state: ReportState;
  verdict: Verdict;
};

export function ReportOptions({
  card,
  state,
  verdict,
}: ReportOptionsProps) {
  const selected = card.options.find((option) => option.id === state.chosen);
  if (selected)
    return (
      <Element className="nx-applied mt-3">
        <b>{selected.label}</b>
        <ul>
          {selected.fx.changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
        {verdict !== card.base && (
          <Element className="nx-vchange">
            <VerdictBadge verdict={card.base} /> →{" "}
            <VerdictBadge verdict={verdict} />
          </Element>
        )}
        <Element
          as="button"
          className="nx-btn ghost slim"
          data-nx="undo"
          data-id={card.id}
        >
          선택 변경 (되돌리기)
        </Element>
      </Element>
    );
  if (!card.options.length) return null;
  return (
    <Element className="mt-3 grid gap-2.5">
      <Element className="nx-seg-title mb-0">
        선택지 · 눌러서 내용을 확인하고 정하세요
      </Element>
      {card.options.map((option) => (
        <OptionCard
          key={option.id}
          cardId={card.id}
          option={option}
          recommended={card.rec?.id === option.id}
        />
      ))}
    </Element>
  );
}
