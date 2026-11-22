import { TaskGroupCard } from "@/components/checklist/TaskGroupCard";
import { filterChecklistTasks } from "@/lib/checklist/filter";
import type { ChecklistTaskFilter, TaskGroup } from "@/types/checklist";

export interface ChecklistTaskListProps {
  groups: TaskGroup[];
  filter: ChecklistTaskFilter;
}

export function ChecklistTaskList({ groups, filter }: ChecklistTaskListProps) {
  const visible = groups
    .map((group) => ({
      group,
      tasks: filterChecklistTasks(group.tasks, filter),
    }))
    .filter(({ tasks }) => tasks.length > 0);
  if (visible.length === 0) {
    const empty = groups.every((group) => group.tasks.length === 0);
    return (
      <p
        role="status"
        className="m-0 py-12 text-center text-base leading-relaxed text-neutral-600"
      >
        {empty
          ? "등록된 준비 항목이 없어요."
          : filter === "done"
            ? "아직 완료한 항목이 없어요."
            : "남은 준비가 없어요."}
      </p>
    );
  }
  return (
    <div className="space-y-10 sm:space-y-8 lg:space-y-12">
      {visible.map(({ group, tasks }) => (
        <TaskGroupCard key={group.title} group={group} visibleTasks={tasks} />
      ))}
    </div>
  );
}
