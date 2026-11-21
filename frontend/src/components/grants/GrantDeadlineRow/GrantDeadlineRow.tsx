import { Element } from "@/components/view/Element";
import { type Grant } from "@/types/grants";

export interface GrantDeadlineRowProps {
  grant: Grant;
  label: string;
  tone: string;
  deadline: string;
}

export function GrantDeadlineRow({
  grant,
  label,
  tone,
  deadline,
}: GrantDeadlineRowProps) {
  return (
    <Element className="nx-lrow">
      <Element className="nx-date">
        {grant.deadline?.slice(8)}일<br />
        <small>{deadline}</small>
      </Element>
      <div style={{ flex: 1 }}>
        <b>{grant.title}</b>
        <Element className="nx-muted">{grant.org}</Element>
      </div>
      <Element as="span" className={`nx-badge ${tone}`}>
        {label}
      </Element>
    </Element>
  );
}
