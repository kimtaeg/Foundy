import type { ReactNode } from "react";

export interface MarketPanelCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}
export function MarketPanelCard({ title, description, children }: MarketPanelCardProps) {
  return (
    <section className="min-w-0">
      <h3 className="m-0 text-lg font-semibold leading-7 tracking-tight text-neutral-900">{title}</h3>
      {description && (
        <p className="mb-0 mt-1 text-sm leading-relaxed text-neutral-600">
          {description}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
