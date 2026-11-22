import { ReportChoiceSummary } from "@/components/report/ReportChoiceSummary";
import { ReportStepButton } from "@/components/report/ReportStepButton";
import type { NextStep, ReportCardData, ReportState } from "@/types/report";

export type ReportOptionsProps = {
  card: ReportCardData;
  state: ReportState;
  actionTitle?: string;
  nextStep?: NextStep;
};

export function ReportOptions({ card, state, actionTitle, nextStep }: ReportOptionsProps) {
  const selected = card.options.find((option) => option.id === state.chosen);
  const decisionTask = card.decisionTask ?? "대응 방법 정하기";
  if (card.options.length && !selected) {
    return <ReportStepButton cardId={card.id} task={decisionTask} kind="choice" />;
  }

  const action = actionTitle ?? selected?.action?.text ?? card.action?.text;
  if (!selected && !action) return null;
  const finishedAction = action && (state.action === "done" || state.action === "sent");
  const completedTask = finishedAction ? action : selected && decisionTask;
  const nextTask = finishedAction ? nextStep : action ?? "적용한 변경 내용 확인";

  return (
    <div className="grid min-w-0 gap-1.5">
      {completedTask && <ReportChoiceSummary cardId={card.id} completedTask={completedTask} />}
      {nextTask && <ReportStepButton cardId={card.id} task={nextTask} kind="next" />}
    </div>
  );
}
