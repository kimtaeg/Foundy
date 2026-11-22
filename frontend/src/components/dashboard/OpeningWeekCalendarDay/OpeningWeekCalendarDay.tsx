import type { Ref } from "react";
import type { OpeningTimelineDay } from "@/types/dashboard";

export interface OpeningWeekCalendarDayProps {
  day: OpeningTimelineDay;
  openingRef?: Ref<HTMLDivElement>;
}

export function OpeningWeekCalendarDay({ day, openingRef }: OpeningWeekCalendarDayProps) {
  const shownTasks = day.tasks.slice(0, day.isOpening ? 1 : 2);
  const extraCount = day.tasks.length - shownTasks.length;

  return (
    <div ref={openingRef} className="relative w-32 shrink-0 before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-linear-to-b before:from-transparent before:via-neutral-300/90 before:to-transparent before:content-[''] first:before:hidden sm:w-40">
      <div className="flex h-9 items-center justify-center">
        <time
          dateTime={day.date}
          aria-label={`${day.isToday ? "오늘 " : ""}${day.isOpening ? "개업일 " : ""}${day.date}`}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums ${day.isOpening ? "bg-foundy-primary-ink text-base font-semibold text-white" : day.isToday ? "bg-foundy-primary/10 text-sm font-semibold text-foundy-primary-ink" : "text-sm text-neutral-600"}`}
        >
          {day.isToday ? "오늘" : <><span>{day.day}일</span><span>({day.weekday})</span></>}
        </time>
      </div>
      <div className="flex h-20 min-w-0 flex-col items-center gap-1 px-2 pt-2 text-center">
        {day.isOpening && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-foundy-primary-ink">
            <span aria-hidden="true" className="size-2 rounded-full bg-foundy-primary motion-safe:animate-pulse" />개업일
          </span>
        )}
        {shownTasks.map((task) => (
          <span key={task.id} title={task.task} className={`block w-full truncate text-xs leading-5 ${task.done ? "text-neutral-500 line-through" : "text-neutral-700"}`}>
            {task.task}
          </span>
        ))}
        {extraCount > 0 && <span className="text-xs font-medium text-foundy-primary-ink">+{extraCount}개 일정</span>}
      </div>
    </div>
  );
}
