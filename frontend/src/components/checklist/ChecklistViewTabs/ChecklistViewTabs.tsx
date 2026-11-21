import { Element } from "@/components/view/Element";
import { type ChecklistContext } from "@/types/checklist";

const tabs = [
  ["timeline", "시기별"],
  ["category", "카테고리별"],
  ["calendar", "달력"],
] as const;
export type ChecklistViewTabsProps = {
  view: ChecklistContext["checkView"];
};

export function ChecklistViewTabs({
  view,
}: ChecklistViewTabsProps) {
  return (
    <Element className="nx-seltabs">
      {tabs.map(([value, label]) => (
        <Element
          as="button"
          key={value}
          className={view === value ? "on" : ""}
          data-nx="cview"
          data-v={value}
        >
          {label}
        </Element>
      ))}
    </Element>
  );
}
