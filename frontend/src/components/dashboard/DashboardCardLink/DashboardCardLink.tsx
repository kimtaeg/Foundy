import type { ReactNode } from "react";

export interface DashboardCardLinkProps {
  page: string;
  children: ReactNode;
  focusId?: string;
  className?: string;
}

export function DashboardCardLink({ page, children, focusId, className = "" }: DashboardCardLinkProps) {
  return (
    <button type="button" data-nx="go" data-p={page} data-focus={focusId}
      className={`inline-flex min-h-11 w-fit cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-transparent py-2 text-base font-semibold text-foundy-primary-ink transition-colors motion-reduce:transition-none hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary ${className}`}>
      {children}
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </svg>
    </button>
  );
}
