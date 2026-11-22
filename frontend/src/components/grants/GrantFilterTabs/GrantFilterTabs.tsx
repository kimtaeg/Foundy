import type { CSSProperties } from "react";

export interface GrantFilterTabsProps {
  options: ReadonlyArray<readonly [string, string]>;
  filter: "res" | "cat";
  selected: string;
  style?: CSSProperties;
}

const groupLabels = { res: "신청 자격", cat: "지원 분야" };

export function GrantFilterTabs({ options, filter, selected, style }: GrantFilterTabsProps) {
  return (
    <div role="group" aria-label={groupLabels[filter]} style={style} className="flex min-w-0 flex-wrap gap-1.5">
      {options.map(([value, label]) => (
        <button key={value} type="button" data-nx="gf" data-k={filter} data-v={value} aria-pressed={value === selected}
          className="min-h-9 rounded-full border-0 bg-neutral-100 px-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 aria-pressed:bg-foundy-primary aria-pressed:text-white motion-reduce:transition-none sm:px-3">
          {label}
        </button>
      ))}
    </div>
  );
}
