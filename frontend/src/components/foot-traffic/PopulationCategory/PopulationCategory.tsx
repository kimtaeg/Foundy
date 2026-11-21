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
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="생활인구 세부 분류">
        {options.map(([value, label]) => (
          <button type="button" key={value} aria-pressed={sub === value} onClick={() => onSubChange(value)}
            className={`rounded-full border border-solid px-3 py-1.5 text-sm ${sub === value ? "border-foundy-primary bg-white font-semibold text-foundy-primary" : "border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
            {label}
          </button>
        ))}
      </div>
      {category !== "type" && <p className="mb-0 mt-2 text-sm text-neutral-600">성별·연령은 내국인 생활인구 기준이에요.</p>}
    </div>
  );
}
