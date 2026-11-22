import type { ChecklistViewData } from "@/types/checklist";

const tabs = [
  ["timeline", "시기별"],
  ["category", "카테고리별"],
  ["calendar", "달력"],
] as const;

export interface ChecklistViewTabsProps {
  view: ChecklistViewData["view"];
}

export function ChecklistViewTabs({ view }: ChecklistViewTabsProps) {
  return (
    <div
      role="group"
      aria-label="체크리스트 보기 방식"
      className="inline-flex w-fit max-w-full gap-1 rounded-xl bg-neutral-100/80 p-1"
    >
      {tabs.map(([value, label]) => (
        <button
          type="button"
          key={value}
          data-nx="cview"
          data-v={value}
          aria-pressed={view === value}
          className={`min-h-11 cursor-pointer rounded-lg border-0 px-3 py-2 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary motion-reduce:transition-none sm:px-4 ${view === value ? "bg-white font-semibold text-foundy-primary-ink" : "bg-transparent text-neutral-600 hover:text-neutral-900"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
