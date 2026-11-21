import { Element } from "@/components/view/Element";

export interface GrantSortSelectProps { sort: "deadline" | "fit" }

export function GrantSortSelect({ sort }: GrantSortSelectProps) {
  return (
    <Element as="label" className="nx-sel">
      정렬{" "}
      <Element as="select" data-nx="gsort" value={sort}>
        <option value="deadline">마감 빠른 순</option>
        <option value="fit">적합도 순</option>
      </Element>
    </Element>
  );
}
