import { CATEGORY_LABEL, type Category } from "@/lib/foot-traffic";

export interface PopulationCategoryTabsProps {
  category: Category;
  onChange: (category: Category) => void;
}

export function PopulationCategoryTabs({ category, onChange }: PopulationCategoryTabsProps) {
  return (
    <div className="flex border-0 border-b border-solid border-neutral-200" role="group" aria-label="생활인구 분류">
      {(["type", "sex", "age"] as Category[]).map((value) => (
        <button type="button" key={value} aria-pressed={value === category} onClick={() => onChange(value)}
          className={`flex-1 border-0 border-b-2 border-solid bg-transparent py-2.5 text-sm ${value === category ? "border-foundy-primary font-bold text-neutral-900" : "border-transparent text-neutral-600"}`}>
          {CATEGORY_LABEL[value]}
        </button>
      ))}
    </div>
  );
}
