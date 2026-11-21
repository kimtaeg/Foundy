import { Element } from "@/components/view/Element";
import { type ResetCard } from "@/types/profile";
import { Fragment } from "react";

export interface ResetCardNoticeProps { cards: ResetCard[] }

export function ResetCardNotice({ cards }: ResetCardNoticeProps) {
  if (!cards.length) return null;
  return (
    <Element className="nx-cons">
      <b>선택이 초기화되는 카드</b>
      <br />
      {cards.map((card, index) => (
        <Fragment key={card.id}>
          {index > 0 && <br />}
          {card.short}
          {card.opt ? ` — “${card.opt}” 선택` : ""}
        </Fragment>
      ))}
      <br />
      <Element as="span" className="nx-muted">
        이 카드들은 다시 결정 대기로 돌아가요.
      </Element>
    </Element>
  );
}
