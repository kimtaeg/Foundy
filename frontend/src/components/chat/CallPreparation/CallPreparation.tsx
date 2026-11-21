import { PhoneContact } from "@/components/common/PhoneContact";
import { Element } from "@/components/view/Element";
import { type CallGuide } from "@/types/chat";
import type { Contact } from "@/types/contact";
export interface CallPreparationProps {
  cardId: string;
  guide: CallGuide;
  contact?: Contact;
  memo: string;
}
export function CallPreparation({ cardId, guide, contact, memo }: CallPreparationProps) {
  return (
    <Element className="nx-call">
      <PhoneContact contact={contact} />
      <Element className="nx-seg-title">30초 통화 순서</Element>
      <ol>
        {guide.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <Element className="nx-seg-title">꼭 물어볼 것</Element>
      <ul>
        {guide.qs.map((question, index) => (
          <li key={index}>{question}</li>
        ))}
      </ul>
      <Element className="nx-seg-title">통화 후 메모</Element>
      <Element
        as="textarea"
        className="nx-ta"
        id={`callmemo-${cardId}`}
        placeholder="예: 담당자 ○○○, 용도변경은 건물주 동의 필요, 내일 문자로 회신 예정"
        value={memo}
      />
      <Element className="nx-row" style={{ marginTop: 8 }}>
        <Element
          as="button"
          className="nx-btn slim"
          data-nx="callsave"
          data-id={cardId}
        >
          통화 마쳤어요 · 결과 기록
        </Element>
      </Element>
      <Element className="nx-muted" style={{ marginTop: 6 }}>
        참고용 스크립트예요. 모르는 칸은 [확인 필요]로 비워 뒀어요.
      </Element>
    </Element>
  );
}
