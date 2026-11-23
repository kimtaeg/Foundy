import type { DashboardTask, OpeningTimelineDay } from "@/types/dashboard";

const dayMilliseconds = 24 * 60 * 60 * 1000;
const weekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;

function utcDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? parsed.getTime() : null;
}

/** Show actual checklist dates and nearby days without allowing a distant date to create an unbounded strip. */
export function buildOpeningTimeline(opening: string, tasks: readonly DashboardTask[], asOf?: string): OpeningTimelineDay[] {
  const openingTime = utcDay(opening);
  if (openingTime === null) return [];

  const dates = [openingTime - 7 * dayMilliseconds, openingTime + 7 * dayMilliseconds];
  const tasksByDate = new Map<string, DashboardTask[]>();
  for (const task of tasks) {
    const dueTime = utcDay(task.due);
    if (dueTime === null || Math.abs(dueTime - openingTime) > 365 * dayMilliseconds) continue;
    dates.push(dueTime);
    const scheduled = tasksByDate.get(task.due) ?? [];
    scheduled.push(task);
    tasksByDate.set(task.due, scheduled);
  }

  const todayTime = asOf ? utcDay(asOf) : null;
  if (todayTime !== null && Math.abs(todayTime - openingTime) <= 365 * dayMilliseconds) dates.push(todayTime);
  const start = Math.min(...dates);
  const end = Math.max(...dates);
  const timeline: OpeningTimelineDay[] = [];
  for (let time = start; time <= end; time += dayMilliseconds) {
    const date = new Date(time);
    const value = date.toISOString().slice(0, 10);
    timeline.push({
      date: value,
      day: date.getUTCDate(),
      weekday: weekdays[date.getUTCDay()],
      isOpening: value === opening,
      isToday: value === asOf,
      tasks: tasksByDate.get(value) ?? [],
    });
  }
  return timeline;
}
