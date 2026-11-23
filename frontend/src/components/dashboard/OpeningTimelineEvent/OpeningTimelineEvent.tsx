export interface OpeningTimelineEventProps {
  label: string;
  tone?: "primary" | "neutral";
  completed?: boolean;
  title?: string;
}

export function OpeningTimelineEvent({ label, tone = "primary", completed = false, title }: OpeningTimelineEventProps) {
  const isPrimary = tone === "primary";

  return (
    <span
      title={title}
      className={`inline-flex w-full min-w-0 items-center justify-center gap-1.5 text-sm font-semibold ${isPrimary ? "text-foundy-primary-ink" : "text-neutral-500"}`}
    >
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${isPrimary ? "bg-foundy-primary motion-safe:animate-pulse" : "bg-neutral-400"}`}
      />
      <span className={`min-w-0 truncate ${completed ? "line-through opacity-60" : ""}`}>{label}</span>
    </span>
  );
}
