import { Element } from "@/components/view/Element";
import { type CalendarDay } from "@/types/checklist";

export type CalendarDayCellProps = {
  day: CalendarDay | null;
  colors: Record<string, string>;
};

export function CalendarDayCell({
  day,
  colors,
}: CalendarDayCellProps) {
  if (!day) return <Element className="nx-cell out" />;
  return (
    <Element
      as="button"
      className={`nx-cell min-w-0 px-1! sm:px-[5px]! ${day.selected ? "sel" : ""} ${day.opening ? "open" : ""} ${day.today ? "today" : ""}`}
      data-nx="calday"
      data-d={day.date}
    >
      <Element as="span" className="nx-dn">
        {day.day}
      </Element>
      {day.opening && (
        <Element as="span" className="nx-flag whitespace-nowrap" aria-label="개업일">
          <span className="sm:hidden">개업</span>
          <span className="hidden sm:inline">개업일</span>
        </Element>
      )}
      <Element as="span" className="nx-dots">
        {day.events
          .filter((event) => event.kind !== "open")
          .slice(0, 4)
          .map((event) => (
            <i
              key={event.id}
              style={{
                background: colors[event.cat] || "#a3a3a3",
                opacity: event.done ? 0.35 : 1,
              }}
            />
          ))}
      </Element>
    </Element>
  );
}
