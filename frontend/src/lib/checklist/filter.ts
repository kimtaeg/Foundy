import type { ChecklistTaskFilter, ChecklistTaskRow } from "@/types/checklist";

export function filterChecklistTasks(
  tasks: ChecklistTaskRow[],
  filter: ChecklistTaskFilter,
) {
  return tasks.filter(
    ({ task }) =>
      filter === "all" || (filter === "done" ? task.done : !task.done),
  );
}
