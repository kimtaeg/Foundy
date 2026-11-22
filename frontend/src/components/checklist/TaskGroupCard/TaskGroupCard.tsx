import { TaskRow } from "@/components/checklist/TaskRow";
import type { ChecklistTaskRow, TaskGroup } from "@/types/checklist";

export interface TaskGroupCardProps {
  group: TaskGroup;
  visibleTasks?: ChecklistTaskRow[];
}

export function TaskGroupCard({
  group,
  visibleTasks = group.tasks,
}: TaskGroupCardProps) {
  const done = group.tasks.filter(({ task }) => task.done).length;
  return (
    <section
      data-checklist-group={group.title}
      className="grid min-w-0 gap-4 border-0 border-t border-solid border-neutral-200 pt-10 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-8 sm:pt-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 lg:pt-12"
    >
      <header className="flex items-center justify-between gap-4 sm:block sm:pt-2">
        <h3 className="m-0 text-lg font-semibold leading-7 tracking-tight text-neutral-900 lg:text-xl">
          {group.title}
        </h3>
        <p className="m-0 shrink-0 text-baseb text-neutral-600 tabular-nums sm:mt-2">
          <span className="font-medium text-foundy-primary-ink">{done}</span> /{" "}
          {group.tasks.length} 완료
        </p>
      </header>
      <ul className="m-0 min-w-0 list-none divide-x-0 divide-y divide-solid divide-neutral-100 p-0">
        {visibleTasks.map((row) => (
          <TaskRow
            key={row.task.id}
            {...row}
            contextLabel={
              group.title === row.task.category
                ? row.task.group
                : row.task.category
            }
          />
        ))}
      </ul>
    </section>
  );
}
