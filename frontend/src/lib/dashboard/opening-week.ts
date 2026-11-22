import type { OpeningWeekDay } from "@/types/dashboard";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;
const dayMilliseconds = 24 * 60 * 60 * 1000;

/** Calendar-only UTC arithmetic keeps the displayed week independent of time zones. */
export function buildOpeningWeek(opening: string): OpeningWeekDay[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opening) || opening.startsWith("0000-")) return [];
  const date = new Date(`${opening}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== opening) return [];
  const sunday = date.getTime() - date.getUTCDay() * dayMilliseconds;
  return weekdays.map((weekday, index) => {
    const current = new Date(sunday + index * dayMilliseconds);
    const value = current.toISOString().slice(0, 10);
    return { date: value, day: current.getUTCDate(), weekday, isOpening: value === opening };
  });
}
