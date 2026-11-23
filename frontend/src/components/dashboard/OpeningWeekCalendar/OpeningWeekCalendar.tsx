"use client";

import { useLayoutEffect, useRef } from "react";
import { OpeningWeekCalendarDay } from "@/components/dashboard/OpeningWeekCalendarDay";
import { buildOpeningTimeline } from "@/lib/dashboard/opening-timeline";
import type { DashboardTask } from "@/types/dashboard";

export interface OpeningWeekCalendarProps {
  opening: string;
  asOf?: string;
  tasks?: DashboardTask[];
  className?: string;
}

export function OpeningWeekCalendar({ opening, asOf, tasks = [], className = "" }: OpeningWeekCalendarProps) {
  const timeline = buildOpeningTimeline(opening, tasks, asOf);
  const viewport = useRef<HTMLDivElement>(null);
  const openingDay = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scrollArea = viewport.current;
    const anchor = openingDay.current;
    if (!scrollArea || !anchor) return;
    const center = () => {
      scrollArea.scrollLeft = anchor.offsetLeft + anchor.offsetWidth / 2 - scrollArea.clientWidth / 2;
    };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(scrollArea);
    return () => observer.disconnect();
  }, [opening, timeline.length]);

  if (!timeline.length) return null;
  const scheduledCount = timeline.reduce((count, day) => count + day.tasks.length, 0);

  return (
    <figure aria-label="개업 일정 타임라인" className={`@container relative m-0 min-w-0 overflow-hidden ${className}`}>
      <figcaption className="sr-only">
        {timeline[0].date}부터 {timeline.at(-1)?.date}까지, 개업일 {opening}, 체크리스트 일정 {scheduledCount}개. 좌우로 스크롤해 날짜별 일정을 확인하세요.
      </figcaption>
      <div className="[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] @min-[560px]:[mask-image:linear-gradient(to_right,transparent,black_24%,black_76%,transparent)]">
        <div
          ref={viewport}
          role="region"
          aria-label="날짜별 준비 일정, 좌우로 스크롤"
          tabIndex={0}
          className="min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-foundy-primary"
        >
          <div className="relative flex w-max min-w-full px-[calc(50%_-_4rem)] sm:px-[calc(50%_-_5rem)]">
            {timeline.map((day) => (
              <OpeningWeekCalendarDay key={day.date} day={day} openingRef={day.isOpening ? openingDay : undefined} />
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
