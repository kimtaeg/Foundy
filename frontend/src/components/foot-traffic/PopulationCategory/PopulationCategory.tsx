import { AGE_GROUPS, SEX_GROUPS, TYPE_LABEL, type Category, type ViewType } from "@/lib/foot-traffic";

export interface PopulationCategoryProps {
  category: Category;
  sub: string;
  onSubChange: (sub: string) => void;
}

export function PopulationCategory({ category, sub, onSubChange }: PopulationCategoryProps) {
  const options = category === "type"
    ? (["all", "local", "fornLong", "fornTemp"] as ViewType[]).map((type) => [type, TYPE_LABEL[type]] as const)
    : category === "sex" ? SEX_GROUPS : AGE_GROUPS;

  return (
    <div className="pb-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="생활인구 세부 분류">
        {options.map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={sub === value}
            onClick={() => onSubChange(value)}
            className="min-h-9 cursor-pointer whitespace-nowrap rounded-full border-0 bg-neutral-100 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-200 aria-pressed:bg-foundy-primary aria-pressed:font-semibold aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foundy-primary"
          >
            {label}
          </button>
        ))}
      </div>
      {category !== "type" && <p className="mb-0 mt-2.5 text-sm leading-relaxed text-neutral-600">성별·연령은 내국인 생활인구 기준이에요.</p>}
    </div>
  );
}
