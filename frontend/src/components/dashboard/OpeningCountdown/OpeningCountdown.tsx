export interface OpeningCountdownProps {
  dayLabel: string;
  label: string;
}

export function OpeningCountdown({ dayLabel, label }: OpeningCountdownProps) {
  return (
    <span aria-label={`${label} ${dayLabel}`}
      className="inline-flex w-fit items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold tabular-nums text-neutral-700">
      {dayLabel}
    </span>
  );
}
