import type { ReactNode } from "react";

export interface DashboardCardProps {
  children: ReactNode;
  className?: string;
  label?: string;
}

export function DashboardCard({ children, className = "", label }: DashboardCardProps) {
  return (
    <section aria-label={label} className={`flex min-w-0 flex-col ${className}`}>
      {children}
    </section>
  );
}
