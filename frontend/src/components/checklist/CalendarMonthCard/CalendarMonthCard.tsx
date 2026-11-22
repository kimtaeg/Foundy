"use client";

import { createContext, useContext, useRef, type ComponentProps } from "react";
import { type DayButtonProps } from "react-day-picker";
import { CalendarDayCell } from "@/components/checklist/CalendarDayCell";
import { CalendarLegend } from "@/components/checklist/CalendarLegend";
import { Calendar } from "@/components/ui/Calendar";
import { D, iso } from "@/lib/date";
import { type CalendarDay } from "@/types/checklist";

export interface CalendarMonthCardProps {
  year: number;
  month: number;
  days: Array<CalendarDay | null>;
  colors: Record<string, string>;
}

const ScheduleContext = createContext<{
  byDate: Map<string, CalendarDay>;
  colors: Record<string, string>;
}>({ byDate: new Map(), colors: {} });

function ScheduleDayButton(props: DayButtonProps) {
  const { byDate, colors } = useContext(ScheduleContext);
  return (
    <CalendarDayCell
      day={byDate.get(props.day.isoDate) ?? null}
      colors={colors}
      pickerButton={props}
    />
  );
}

function PreviousMonthButton(props: ComponentProps<"button">) {
  return (
    <button {...props} onClick={undefined} data-nx="calmove" data-n={-1} />
  );
}

function NextMonthButton(props: ComponentProps<"button">) {
  return <button {...props} onClick={undefined} data-nx="calmove" data-n={1} />;
}

const components = {
  DayButton: ScheduleDayButton,
  PreviousMonthButton,
  NextMonthButton,
};

export function CalendarMonthCard({
  year,
  month,
  days,
  colors,
}: CalendarMonthCardProps) {
  const container = useRef<HTMLElement>(null);
  const byDate = new Map(
    days.filter((day) => day !== null).map((day) => [day.date, day]),
  );
  const today = days.find((day) => day?.today);
  const selected = days.find((day) => day?.selected);

  // Arrow and Page keys may move focus to another month or year. Use the
  // same delegated navigation action as the visible month buttons.
  function navigateWithKeyboard(target: Date) {
    const offset =
      (target.getFullYear() - year) * 12 + target.getMonth() - month;
    container.current
      ?.querySelector<HTMLButtonElement>(`[data-nx="calmove"][data-n="${offset}"]`)
      ?.click();
  }

  return (
    <section ref={container} className="min-w-0" aria-label="월별 준비 일정">
      <ScheduleContext.Provider value={{ byDate, colors }}>
        <div className="max-[347px]:-mx-3.5">
          <Calendar
            className="w-full"
            mode="single"
            required
            month={new Date(year, month, 1)}
            selected={selected ? D(selected.date) : undefined}
            today={today ? D(today.date) : undefined}
            hidden={(date) =>
              date.getFullYear() === year &&
              date.getMonth() === month &&
              !byDate.has(iso(date))
            }
            onMonthChange={navigateWithKeyboard}
            onSelect={() => {
              // The delegated calday action owns this controlled selection.
            }}
            showOutsideDays={false}
            components={components}
            classNames={{
              day: "relative p-0 align-top",
              today: "",
            }}
            labels={{
              labelPrevious: () => "이전 달",
              labelNext: () => "다음 달",
            }}
          />
        </div>
      </ScheduleContext.Provider>
      {[-12, 12].map((offset) => (
        <button key={offset} hidden type="button" data-nx="calmove" data-n={offset} />
      ))}
      <CalendarLegend colors={colors} />
    </section>
  );
}
