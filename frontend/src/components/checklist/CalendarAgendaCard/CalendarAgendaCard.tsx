import { CalendarEventRow } from "@/components/checklist/CalendarEventRow";
import { Element } from "@/components/view/Element";
import { type CalendarEvent } from "@/types/checklist";

export interface CalendarAgendaCardProps {
  selected: string | null;
  events: CalendarEvent[];
  colors: Record<string, string>;
}
export function CalendarAgendaCard({ selected, events, colors }: CalendarAgendaCardProps) {
  return (
    <Element as="aside" className="nx-card">
      <h3>
        {selected
          ? `${selected.replace(/-/g, ".")} 일정`
          : "날짜를 눌러 보세요"}
      </h3>
      {selected ? (
        events.length ? (
          events.map((event) => (
            <CalendarEventRow
              key={event.id}
              event={event}
              color={colors[event.cat] || "var(--primary)"}
            />
          ))
        ) : (
          <Element className="nx-empty">이 날은 일정이 없어요.</Element>
        )
      ) : (
        <Element className="nx-muted">
          점은 해야 할 일, 깃발은 개업일이에요. 지원사업 마감도 함께 보여요.
        </Element>
      )}
    </Element>
  );
}
