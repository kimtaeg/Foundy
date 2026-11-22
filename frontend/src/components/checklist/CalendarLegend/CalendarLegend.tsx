export type CalendarLegendProps = { colors: Record<string, string> };

export function CalendarLegend({ colors }: CalendarLegendProps) {
  return (
    <ul
      className="mt-4 mb-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 border-0 border-t border-solid border-neutral-200 ps-0 pt-4"
      aria-label="일정 분류"
    >
      {Object.entries(colors).map(([category, color]) => (
        <li
          className="inline-flex items-center gap-2 text-[13px] leading-5 text-neutral-600"
          key={category}
        >
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {category}
        </li>
      ))}
    </ul>
  );
}
