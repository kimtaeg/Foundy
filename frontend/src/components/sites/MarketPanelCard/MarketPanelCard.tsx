import type { ReactNode } from "react";

export interface MarketPanelCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}
export function MarketPanelCard({ title, description, children }: MarketPanelCardProps) {
  return (
    <section className="rounded-2xl p-2">
      <h3 className="m-0 text-base font-bold leading-snug text-neutral-900">{title}</h3>
      {description && (
        <p className="mb-3 mt-1 text-sm leading-relaxed text-neutral-600">
          {description}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}
