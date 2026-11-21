import { NextStepItem } from "@/components/report/NextStepItem";
import { Element } from "@/components/view/Element";
import { type ReportCardModel } from "@/types/report";

export type ReportNextStepsProps = { model: ReportCardModel };

export function ReportNextSteps({ model }: ReportNextStepsProps) {
  const { state, card, nextSteps, shortTitle } = model;
  if (
    (state.action !== "sent" && state.action !== "done") ||
    (card.options.length > 0 && !state.chosen)
  )
    return null;
  const heading =
    state.action === "done"
      ? `✅ “${shortTitle}” 처리 완료! 이제 이 순서로 하세요.`
      : "⏳ 문의했어요. 답변을 기다리는 동안 이걸 먼저 하세요.";
  return (
    <Element className="nx-next">
      <Element className="nx-seg-title">🔜 다음으로 할 일 (자동 정리)</Element>
      <b>{heading}</b>
      {nextSteps.length ? (
        <ol>
          {nextSteps.map((step, index) => (
            <NextStepItem key={`${step.t}-${index}`} step={step} />
          ))}
        </ol>
      ) : (
        <>
          <Element className="nx-muted my-2">
            점검 리포트의 모든 항목을 마쳤어요. 체크리스트에서 개업 준비를
            이어가세요.
          </Element>
          <Element
            as="button"
            className="nx-btn slim"
            data-nx="cnav"
            data-p="checklist"
            data-focus=""
          >
            체크리스트 열기 →
          </Element>
        </>
      )}
    </Element>
  );
}
