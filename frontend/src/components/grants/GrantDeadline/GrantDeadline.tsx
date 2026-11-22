import { GrantBadge } from "@/components/grants/GrantBadge";

export interface GrantDeadlineProps {
  date: string | null;
  label?: string;
  applicationPeriod?: string;
}

export function GrantDeadline({ date, label, applicationPeriod }: GrantDeadlineProps) {
  if (!date) return <>{applicationPeriod || "일정 미정"}</>;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
      <time dateTime={date}>{date.replaceAll("-", ".")}</time>
      {label && <GrantBadge label={label} />}
    </span>
  );
}
