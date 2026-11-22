import { GROUPS } from "@/data/checklist";
import type { DashboardStageProgress, DashboardTask } from "@/types/dashboard";

/** Summaries use the complete checklist; the limited preview retains completed tasks. */
export function buildDashboardPreparation(tasks: readonly DashboardTask[], limit = 4) {
  const groups = new Map<string, DashboardStageProgress>();
  let done = 0;
  for (const task of tasks) {
    const stage = groups.get(task.group) ?? { label: task.group, done: 0, total: 0 };
    stage.total += 1;
    if (task.done) {
      stage.done += 1;
      done += 1;
    }
    groups.set(task.group, stage);
  }

  const order: readonly string[] = GROUPS;
  const rank = (label: string) => {
    const index = order.indexOf(label);
    return index === -1 ? order.length : index;
  };
  const stages = [...groups.values()].sort((left, right) => rank(left.label) - rank(right.label));
  const previewTasks = [...tasks]
    .sort((left, right) => (left.due || "9999-12-31").localeCompare(right.due || "9999-12-31"))
    .slice(0, Math.max(0, limit));

  return { stages, taskCount: { done, total: tasks.length }, tasks: previewTasks };
}
