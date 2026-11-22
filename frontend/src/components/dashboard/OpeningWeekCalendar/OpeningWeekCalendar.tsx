import type { CSSProperties } from "react";
import { OpeningWeekCalendarDay } from "@/components/dashboard/OpeningWeekCalendarDay";
import { buildOpeningWeek } from "@/lib/dashboard/opening-week";

export interface OpeningWeekCalendarProps {
  opening: string;
  className?: string;
}

export function OpeningWeekCalendar({ opening, className = "" }: OpeningWeekCalendarProps) {
  const week = buildOpeningWeek(opening);
  if (!week.length) return null;
  const openingIndex = week.findIndex((day) => day.isOpening);

  return (
    <figure aria-label="개업 주간 미니 캘린더" className={`@container relative m-0 min-w-0 overflow-hidden ${className}`}>
      <figcaption className="sr-only">{week[0].date}부터 {week[6].date}까지, 개업일 {opening}</figcaption>
      <div className="overflow-hidden [--calendar-fade:12%] [mask-image:linear-gradient(to_right,transparent,black_var(--calendar-fade),black_calc(100%_-_var(--calendar-fade)),transparent)] @min-[200px]:[--calendar-fade:22%] @min-[560px]:[--calendar-fade:30%]">
        <div
          className="relative left-1/2 grid w-[784px] -translate-x-[var(--opening-position)] grid-cols-[repeat(7,minmax(112px,1fr))] @min-[784px]:left-0 @min-[784px]:w-full @min-[784px]:translate-x-0"
          style={{ "--opening-position": `${(openingIndex + 0.5) / 7 * 100}%` } as CSSProperties}
        >
          {week.map((day) => <OpeningWeekCalendarDay key={day.date} day={day} />)}
        </div>
      </div>
    </figure>
  );
}
