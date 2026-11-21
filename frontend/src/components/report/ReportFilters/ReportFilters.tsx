import { Element } from "@/components/view/Element";

export type ReportFiltersProps = { selected: string };

export function ReportFilters({ selected }: ReportFiltersProps) {
  return (
    <Element className="nx-seltabs">
      {["all", "계약 전", "개업 전", "운영 중"].map((stage) => (
        <Element
          as="button"
          key={stage}
          className={selected === stage ? "on" : ""}
          data-nx="rfilter"
          data-v={stage}
        >
          {stage === "all" ? "전체" : stage}
        </Element>
      ))}
    </Element>
  );
}
