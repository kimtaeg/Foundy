import { GrantCardActions } from "@/components/grants/GrantCardActions";
import { GrantConditions } from "@/components/grants/GrantConditions";
import { GrantEligibility } from "@/components/grants/GrantEligibility";
import { GrantPoster } from "@/components/grants/GrantPoster";
import { GrantSummary } from "@/components/grants/GrantSummary";
import { Element } from "@/components/view/Element";
import { type Grant } from "@/types/grants";

export interface GrantCardProps {
  grant: Grant;
  label: string;
  tone: string;
  deadline: string;
}

export function GrantCard({
  grant,
  label,
  tone,
  deadline,
}: GrantCardProps) {
  return (
    <Element as="article" className="nx-gcard">
      <GrantPoster grant={grant} deadline={deadline} />
      <Element className="nx-gbody">
        <GrantEligibility label={label} tone={tone} example={grant.example} />
        <h3>{grant.title}</h3>
        <GrantSummary grant={grant} deadline={deadline} />
        <GrantConditions checks={grant.checks} />
        <GrantCardActions id={grant.id} />
      </Element>
    </Element>
  );
}
