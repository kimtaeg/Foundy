import { CalendarEventRow } from "@/components/checklist/CalendarEventRow";
import { type CalendarEvent } from "@/types/checklist";

export interface CalendarAgendaCardProps {
  selected: string | null;
  events: CalendarEvent[];
  colors: Record<string, string>;
}

export function CalendarAgendaCard({
  selected,
  events,
  colors,
}: CalendarAgendaCardProps) {
  return (
    <aside className="min-w-0" aria-label="선택한 날짜의 일정">
      <header className="mb-5 flex min-h-11 items-center justify-between gap-3">
        <h3
          className="m-0 text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
          aria-live="polite"
        >
          {selected ? `${selected.replace(/-/g, ".")} 일정` : "날짜별 일정"}
        </h3>
        {selected && events.length > 0 && (
          <span className="shrink-0 text-sm tabular-nums text-neutral-600">
            {events.length}개
          </span>
        )}
      </header>
      {selected && events.length > 0 ? (
        <div>
          {events.map((event) => (
            <CalendarEventRow
              key={event.id}
              event={event}
              color={colors[event.cat] || "rgb(16, 126, 125)"}
            />
          ))}
        </div>
      ) : (
        <p className="m-0 border-t border-neutral-200 py-8 text-sm leading-relaxed text-neutral-600">
          {selected
            ? "이 날은 예정된 일정이 없어요."
            : "날짜를 선택해 준비할 일을 확인하세요."}
        </p>
      )}
    </aside>
  );
}
