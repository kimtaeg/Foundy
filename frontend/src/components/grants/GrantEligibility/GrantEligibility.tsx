import { GrantBadge } from "@/components/grants/GrantBadge";

export interface GrantEligibilityProps {
  label: string;
  tone: string;
  organization?: string;
  deadline?: string;
}

export function GrantEligibility({ label, tone, organization, deadline }: GrantEligibilityProps) {
  return (
    <span className="flex max-w-full flex-wrap items-center gap-1.5">
      <GrantBadge label={label} tone={tone} />
      {organization && <GrantBadge prefix="주관 기관" label={organization} />}
      {deadline && <GrantBadge label={deadline} />}
    </span>
  );
}
