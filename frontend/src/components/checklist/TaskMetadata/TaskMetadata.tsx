import { Element } from "@/components/view/Element";
import type { ChecklistTask, ChecklistContact } from "@/types/checklist";
export interface TaskMetadataProps {
  task: ChecklistTask;
  contact: ChecklistContact | null;
}
export function TaskMetadata({ task, contact }: TaskMetadataProps) {
  return (
    <Element className="nx-muted">
      {task.category}
      {task.documents && <> · 필요 서류: {task.documents}</>}
      {task.agency && <> · 담당: {task.agency}</>}
      {contact && (
        <>
          {" "}
          · ☎ {contact.phone}
          {contact.ex ? " (예시)" : ""}
        </>
      )}
    </Element>
  );
}
