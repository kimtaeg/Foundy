import type { DashboardScheduleMonth, DashboardTask } from "@/types/dashboard";

function dueMonth(due: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= monthDays[month - 1] ? due.slice(0, 7) : null;
}

/** Each dated, incomplete task contributes once; empty months are not invented. */
export function buildDashboardSchedule(
  tasks: readonly Pick<DashboardTask, "due" | "done">[],
): DashboardScheduleMonth[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.done) continue;
    const month = dueMonth(task.due);
    if (month) counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, count]) => ({ month, count }));
}
