import { Element } from "@/components/view/Element";
import { CSSProperties } from "react";

export interface GrantFilterTabsProps {
  options: ReadonlyArray<readonly [string, string]>;
  filter: "res" | "cat" | "view";
  selected: string;
  style?: CSSProperties;
}
export function GrantFilterTabs({ options, filter, selected, style }: GrantFilterTabsProps) {
  return (
    <Element className="nx-seltabs" style={style}>
      {options.map(([value, label]) => (
        <Element
          as="button"
          key={value}
          className={value === selected ? "on" : ""}
          data-nx="gf"
          data-k={filter}
          data-v={value}
        >
          {label}
        </Element>
      ))}
    </Element>
  );
}
