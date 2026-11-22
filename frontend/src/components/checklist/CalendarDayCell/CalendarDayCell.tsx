import { DayButton, type DayButtonProps } from "react-day-picker";
import { type CalendarDay } from "@/types/checklist";

export type CalendarDayCellProps = {
  day: CalendarDay | null;
  colors: Record<string, string>;
  pickerButton?: DayButtonProps;
};

export function CalendarDayCell({
  day,
  colors,
  pickerButton,
}: CalendarDayCellProps) {
  if (!day) return <div aria-hidden="true" className="min-h-14 sm:min-h-18" />;

  const events = day.events.filter((event) => event.kind !== "open");
  const description = [
    day.date.replace(/-/g, "."),
    day.today && "오늘",
    day.opening && "개업일",
    day.events.length ? `일정 ${day.events.length}개` : "일정 없음",
  ]
    .filter(Boolean)
    .join(", ");

  const button = {
    type: "button" as const,
    className: `relative flex min-h-14 w-full min-w-11 flex-col items-center gap-1 rounded-lg border-0 px-0.5 py-1.5 transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foundy-primary motion-reduce:transition-none sm:min-h-18 sm:py-2 ${day.selected ? "bg-[#edf6f5]" : "bg-transparent hover:bg-neutral-50"}`,
    "data-nx": "calday",
    "data-d": day.date,
    "aria-label": description,
    "aria-pressed": day.selected,
    "aria-current": day.today ? ("date" as const) : undefined,
  };
  const content = (
    <>
      <span
        className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm tabular-nums ${day.selected ? "bg-foundy-primary font-semibold text-white" : day.today ? "font-semibold text-foundy-primary-ink ring-1 ring-inset ring-foundy-primary/50" : "font-medium text-neutral-700"}`}
      >
        {day.day}
      </span>
      {day.opening && (
        <span className="whitespace-nowrap rounded-sm bg-foundy-primary/10 px-1 text-xs leading-4 font-semibold text-foundy-primary-ink">
          <span className="sm:hidden">개업</span>
          <span className="hidden sm:inline">개업일</span>
        </span>
      )}
      {events.length > 0 && (
        <span
          aria-hidden="true"
          className="flex min-h-1 items-center justify-center gap-[3px]"
        >
          {events.slice(0, 4).map((event) => (
            <span
              key={event.id}
              className="size-1 rounded-full"
              style={{
                backgroundColor: colors[event.cat] || "#a3a3a3",
                opacity: event.done ? 0.35 : 1,
              }}
            />
          ))}
        </span>
      )}
    </>
  );

  return pickerButton ? (
    <DayButton
      {...pickerButton}
      {...button}
      // DayPicker stops click propagation. The checklist owns the selection
      // through data-nx, while DayButton still owns roving focus and key events.
      onClick={(event) => event.currentTarget.focus({ preventScroll: true })}
    >
      {content}
    </DayButton>
  ) : (
    <button {...button}>{content}</button>
  );
}
