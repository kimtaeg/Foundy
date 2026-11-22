import { Element } from "@/components/view/Element";
import { type DashboardAction } from "@/types/dashboard";

export type ActionItemProps = { item: DashboardAction };

export function ActionItem({ item }: ActionItemProps) {
  return (
    <Element className="nx-check">
      <div className="flex-1">
        <b>{item.action.text}</b>
        <Element className="nx-muted">결과 카드 · {item.action.min}분</Element>
      </div>
      <Element
        as="button"
        className="nx-btn outline"
        data-nx="go"
        data-p="report"
        data-focus={item.id}
      >
        열기
      </Element>
    </Element>
  );
}
