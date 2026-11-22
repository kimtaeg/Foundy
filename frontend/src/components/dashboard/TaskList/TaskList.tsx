import { ActionItem } from "@/components/dashboard/ActionItem";
import { TaskItem } from "@/components/dashboard/TaskItem";
import { Element } from "@/components/view/Element";
import { type DashboardAction, type DashboardTask } from "@/types/dashboard";

export type TaskListProps = {
  actions: DashboardAction[];
  tasks: DashboardTask[];
};

export function TaskList({
  actions,
  tasks,
}: TaskListProps) {
  return (
    <Element as="section" className="nx-card">
      <Element className="nx-heading">
        <h3>내가 직접 할 일</h3>
        <Element
          as="button"
          className="nx-btn ghost"
          data-nx="go"
          data-p="checklist"
        >
          체크리스트 →
        </Element>
      </Element>
      {actions.map((item) => (
        <ActionItem key={item.id} item={item} />
      ))}
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </Element>
  );
}
