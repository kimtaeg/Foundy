import { CalendarDayCell } from "@/components/checklist/CalendarDayCell";
import { CalendarLegend } from "@/components/checklist/CalendarLegend";
import { Element } from "@/components/view/Element";
import { type CalendarDay } from "@/types/checklist";

export interface CalendarMonthCardProps {
  year: number;
  month: number;
  days: Array<CalendarDay | null>;
  colors: Record<string, string>;
}
export function CalendarMonthCard({ year, month, days, colors }: CalendarMonthCardProps) {
  return (
    <Element as="section" className="nx-card">
      <Element className="nx-heading">
        <Element
          as="button"
          className="nx-btn outline slim"
          data-nx="calmove"
          data-n="-1"
          aria-label="이전 달"
        >
          ←
        </Element>
        <h3 style={{ margin: 0 }}>
          {year}년 {month + 1}월
        </h3>
        <Element
          as="button"
          className="nx-btn outline slim"
          data-nx="calmove"
          data-n="1"
          aria-label="다음 달"
        >
          →
        </Element>
      </Element>
      <Element className="nx-week">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </Element>
      <Element className="nx-calgrid">
        {days.map((day, index) => (
          <CalendarDayCell
            key={day?.date ?? `empty-${index}`}
            day={day}
            colors={colors}
          />
        ))}
      </Element>
      <CalendarLegend colors={colors} />
    </Element>
  );
}
