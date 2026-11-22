import { Element } from "@/components/view/Element";
import { ReactNode } from "react";

export type MetricCardProps = {
  label: string;
  value: ReactNode;
  caption?: string;
};

export function MetricCard({
  label,
  value,
  caption,
}: MetricCardProps) {
  return (
    <Element className="nx-metric">
      <Element as="span" className="nx-muted">
        {label}
      </Element>
      <b>{value}</b>
      {caption !== undefined && (
        <Element as="span" className="nx-tag">
          {caption}
        </Element>
      )}
    </Element>
  );
}
