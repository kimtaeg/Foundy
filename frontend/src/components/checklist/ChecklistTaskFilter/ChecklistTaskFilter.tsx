import type { ChecklistTaskFilter as TaskFilter } from "@/types/checklist";

const filters = [
  ["all", "전체"],
  ["remaining", "남은 일"],
  ["done", "완료"],
] as const;

export interface ChecklistTaskFilterProps {
  value: TaskFilter;
  onChange: (value: TaskFilter) => void;
}

export function ChecklistTaskFilter({
  value,
  onChange,
}: ChecklistTaskFilterProps) {
  return (
    <div
      role="group"
      aria-label="완료 상태 필터"
      className="flex items-center gap-1.5"
    >
      {filters.map(([filter, label]) => (
        <button
          type="button"
          key={filter}
          aria-pressed={value === filter}
          onClick={() => onChange(filter)}
          className={`min-h-9 cursor-pointer whitespace-nowrap rounded-full border-0 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary motion-reduce:transition-none ${value === filter ? "bg-foundy-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
