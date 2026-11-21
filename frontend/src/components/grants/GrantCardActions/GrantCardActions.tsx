import { Element } from "@/components/view/Element";

export interface GrantCardActionsProps { id: string }

export function GrantCardActions({ id }: GrantCardActionsProps) {
  return (
    <Element className="nx-row" style={{ marginTop: 10 }}>
      <Element
        as="button"
        className="nx-btn slim"
        data-nx="gdetail"
        data-id={id}
      >
        자세히
      </Element>
    </Element>
  );
}
