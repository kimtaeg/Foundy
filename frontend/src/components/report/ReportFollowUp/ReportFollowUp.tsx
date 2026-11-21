import { PhoneContact } from "@/components/common/PhoneContact";
import { Element } from "@/components/view/Element";
import { type ReportCardModel } from "@/types/report";

/** 선택지를 정한 뒤 이어지는 다음 할 일. "했어요" 한 번으로 완료된다. */
export type ReportFollowUpProps = { model: ReportCardModel };

export function ReportFollowUp({ model }: ReportFollowUpProps) {
  const { card, action, state, contact } = model;
  if (!action || (card.options.length > 0 && !state.chosen)) return null;
  if (state.action === "done")
    return (
      <Element className="nx-seg">
        <Element className="nx-ok">
          ✓ 다음 할 일을 마쳤어요 · {action.text}
        </Element>
        <Element
          as="button"
          className="nx-btn ghost slim mt-2"
          data-nx="actreset"
          data-id={card.id}
        >
          되돌리기
        </Element>
      </Element>
    );
  return (
    <Element className="nx-seg">
      <Element className="nx-seg-title">다음 할 일</Element>
      <b className="block text-[15px] leading-6">
        {action.text}{" "}
        {action.min > 0 && (
          <Element as="span" className="nx-muted">
            · {action.min}분
          </Element>
        )}
      </b>
      {action.type === "send" && contact && (
        <Element className="mt-2">
          <PhoneContact contact={contact} />
        </Element>
      )}
      <Element className="nx-row mt-2">
        {action.go && (
          <Element
            as="button"
            className="nx-btn outline"
            data-nx="go"
            data-p={action.go.page}
          >
            {action.go.label}
          </Element>
        )}
        <Element
          as="button"
          className="nx-btn"
          data-nx="actdone"
          data-id={card.id}
        >
          했어요
        </Element>
      </Element>
    </Element>
  );
}
