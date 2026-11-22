import type { OpeningWeekDay } from "@/types/dashboard";

export interface OpeningWeekCalendarDayProps {
  day: OpeningWeekDay;
}

export function OpeningWeekCalendarDay({ day }: OpeningWeekCalendarDayProps) {
  return (
    <div className="relative min-w-0 before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-linear-to-b before:from-transparent before:via-neutral-300/90 before:to-transparent before:content-[''] first:before:hidden">
      <div className="flex h-9 items-center justify-center">
        <time
          dateTime={day.date}
          aria-label={day.isOpening ? `개업일 ${day.date}` : undefined}
          className={`inline-flex items-center gap-1 tabular-nums px-2 py-0.5 rounded-full ${day.isOpening ? "text-base font-semibold text-white bg-foundy-primary-ink" : "text-sm text-neutral-600"}`}
        >
          <span>{day.day}일</span>
          <span>({day.weekday})</span>
        </time>
      </div>
      <div className="flex h-11 items-center justify-center">
        {day.isOpening && (
          <span className="inline-flex items-center gap-1.5 text-base font-semibold text-foundy-primary-ink">
            <span aria-hidden="true" className="size-2 rounded-full bg-foundy-primary motion-safe:animate-pulse" />개업일
          </span>
        )}
      </div>
    </div>
  );
}
