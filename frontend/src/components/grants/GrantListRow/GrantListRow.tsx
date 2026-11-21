import { GrantEligibility } from "@/components/grants/GrantEligibility";
import { GrantPoster } from "@/components/grants/GrantPoster";
import { Element } from "@/components/view/Element";
import { type Grant } from "@/types/grants";

export interface GrantListRowProps {
  grant: Grant;
  label: string;
  tone: string;
  deadline: string;
}

export function GrantListRow({
  grant,
  label,
  tone,
  deadline,
}: GrantListRowProps) {
  return (
    <Element className="nx-lrow max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-start">
      <div className="w-20 shrink-0 max-sm:hidden">
        <GrantPoster grant={grant} deadline={deadline} />
      </div>
      <div className="min-w-0 flex-1">
        <GrantEligibility label={label} tone={tone} />
        <b>{grant.title}</b>
        <Element className="nx-muted">
          {grant.org} · {grant.amount}
        </Element>
      </div>
      <Element className="nx-date max-sm:col-start-1 max-sm:row-start-2 max-sm:flex max-sm:items-baseline max-sm:gap-2 max-sm:text-left max-sm:[&_br]:hidden">
        {grant.deadline ? grant.deadline.slice(5).replace("-", ".") : "미정"}
        <br />
        <small>{grant.deadline ? deadline : ""}</small>
      </Element>
      <Element
        as="button"
        className="nx-btn slim max-sm:col-start-2 max-sm:row-start-1 max-sm:row-span-2 max-sm:self-center"
        data-nx="gdetail"
        data-id={grant.id}
      >
        자세히
      </Element>
    </Element>
  );
}
