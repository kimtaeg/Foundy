export interface GrantBadgeProps {
  label: string;
  prefix?: string;
  tone?: string;
}

export function GrantBadge({ label, prefix, tone }: GrantBadgeProps) {
  if (!label.trim()) return null;
  const color = tone === "ok" ? "bg-foundy-primary/10 text-foundy-primary-ink"
    : tone === "low" ? "bg-[var(--amber-bg)] text-[var(--amber)]"
    : "bg-neutral-100 text-neutral-700";
  return (
    <span className={`inline-block max-w-full rounded-md px-2 py-0.5 text-[13px] font-semibold leading-5 [overflow-wrap:anywhere] ${color}`}>
      {prefix && <span className="sr-only">{prefix} </span>}{label}
    </span>
  );
}
