import { GrantCardActions } from "@/components/grants/GrantCardActions";
import { GrantEligibility } from "@/components/grants/GrantEligibility";
import { GrantPoster } from "@/components/grants/GrantPoster";
import { GrantSummary } from "@/components/grants/GrantSummary";
import { grantDisplay } from "@/lib/grants/format-grant";
import type { Grant } from "@/types/grants";

export interface GrantCardProps {
  grant: Grant;
  label: string;
  tone: string;
  deadline: string;
}

export function GrantCard({ grant, label, tone, deadline }: GrantCardProps) {
  const { title, org } = grantDisplay(grant);
  return (
    <article className="flex min-w-0 flex-col items-start [container-type:inline-size]">
      <GrantPoster grant={grant} />
      <div className="mt-4">
        <GrantEligibility label={label} tone={tone} organization={org} deadline={grant.deadline ? deadline : undefined} />
      </div>
      <GrantSummary grant={grant} />
      <GrantCardActions id={grant.id} title={title} />
    </article>
  );
}
