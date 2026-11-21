import { Element } from "@/components/view/Element";
import { ReactNode } from "react";

export type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <Element className="headrow">
      <div>
        <Element className="eyebrow">{eyebrow}</Element>
        <Element as="h1" className="pagetitle">
          {title}
        </Element>
        <Element as="p" className="subtitle">
          {description}
        </Element>
      </div>
      {actions}
    </Element>
  );
}
