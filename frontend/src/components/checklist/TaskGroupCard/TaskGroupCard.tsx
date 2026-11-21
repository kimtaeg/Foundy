import { TaskRow } from "@/components/checklist/TaskRow";
import { Element } from "@/components/view/Element";
import { type TaskGroup } from "@/types/checklist";

export interface TaskGroupCardProps {
  group: TaskGroup;
}
export function TaskGroupCard({ group }: TaskGroupCardProps) {
  return (
    <Element as="section" className="nx-card">
      <h3>
        {group.title}{" "}
        <Element as="span" className="nx-badge">
          {group.tasks.length}개
        </Element>
      </h3>
      {group.tasks.map((row) => (
        <TaskRow key={row.task.id} {...row} />
      ))}
    </Element>
  );
}
