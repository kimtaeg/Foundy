import { TaskKindBadge } from "@/components/checklist/TaskKindBadge";
import { TaskMetadata } from "@/components/checklist/TaskMetadata";
import { TaskReason } from "@/components/checklist/TaskReason";
import { Element } from "@/components/view/Element";
import type { ChecklistTaskRow } from "@/types/checklist";

export type TaskRowProps = ChecklistTaskRow;

export function TaskRow({ task, contact, deadline, documentCount }: TaskRowProps) {
  return (
    <Element className="nx-check">
      <Element
        as="input"
        className="shrink-0"
        type="checkbox"
        checked={task.done}
        data-task={task.id}
        aria-label={`${task.task} 완료`}
      />
      <div className="min-w-0 flex-1">
        <TaskKindBadge kind={task.kind} aiAdded={task.aiAdded} />
        <b
          className={task.done ? "text-neutral-600 line-through" : undefined}
        >
          {task.task}
        </b>
        <TaskMetadata task={task} contact={contact} />
        <TaskReason task={task} />
        {documentCount > 0 && (
          <Element
            as="button"
            className="nx-btn ghost slim max-w-full whitespace-normal! text-left"
            data-nx="godocs"
            data-tid={task.id}
          >
            필요 서류 {documentCount}개 · 서류함에서 보기 →
          </Element>
        )}
      </div>
      <Element className="nx-date">
        {task.kind && <small>권장 준비일</small>}
        {task.kind && <br />}
        {task.due.slice(5).replace("-", ".")}
        <br />
        <small>{deadline}</small>
        {task.statutory && (
          <>
            <br />
            <small>법정 {task.statutory.date.slice(5).replace("-", ".")}</small>
          </>
        )}
      </Element>
    </Element>
  );
}
