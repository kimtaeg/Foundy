import type { ReactNode } from "react";

export interface DashboardSectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function DashboardSectionHeader({ title, description, action }: DashboardSectionHeaderProps) {
  return (
    <header className="mb-5">
      <div className="flex min-h-7 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className="m-0 text-lg font-semibold leading-7 tracking-tight text-neutral-900 sm:text-xl">{title}</h2>
        {action && <div className="shrink-0 leading-7">{action}</div>}
      </div>
      {description && <p className="mb-0 mt-1.5 text-base leading-relaxed text-neutral-600">{description}</p>}
    </header>
  );
}
