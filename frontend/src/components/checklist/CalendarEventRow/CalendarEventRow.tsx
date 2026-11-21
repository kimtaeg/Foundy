import { Element } from "@/components/view/Element";
import { type CalendarEvent } from "@/types/checklist";

export type CalendarEventRowProps = {
  event: CalendarEvent;
  color: string;
};

export function CalendarEventRow({
  event,
  color,
}: CalendarEventRowProps) {
  return (
    <Element className="nx-check">
      {event.kind === "task" ? (
        <Element
          as="input"
          type="checkbox"
          data-task={event.id}
          checked={event.done}
          aria-label={`${event.t} 완료`}
        />
      ) : (
        <Element as="span" className="nx-dot" style={{ background: color }} />
      )}
      <div style={{ flex: 1 }}>
        <b
          className={event.done ? "text-neutral-600 line-through" : undefined}
        >
          {event.t}
        </b>
        <Element className="nx-muted">{event.cat}</Element>
      </div>
    </Element>
  );
}
