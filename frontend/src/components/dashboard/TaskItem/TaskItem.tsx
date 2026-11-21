import { Element } from "@/components/view/Element";
import { type DashboardTask } from "@/types/dashboard";

export type TaskItemProps = { task: DashboardTask };

export function TaskItem({ task }: TaskItemProps) {
  return (
    <Element className="nx-check">
      <Element
        as="input"
        type="checkbox"
        data-task={task.id}
        aria-label={`${task.task} 완료`}
      />
      <div className="flex-1">
        <b>{task.task}</b>
        <Element className="nx-muted">
          {task.group} · {task.category} · {task.due.slice(5).replace("-", ".")}
        </Element>
      </div>
    </Element>
  );
}
