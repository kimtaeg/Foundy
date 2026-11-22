import { TaskDeadline } from "@/components/checklist/TaskDeadline";
import { TaskMetadata } from "@/components/checklist/TaskMetadata";
import { Input } from "@/components/ui/Input";
import type { ChecklistTaskRow } from "@/types/checklist";

export interface TaskRowProps extends ChecklistTaskRow {
  contextLabel?: string;
}

export function TaskRow({
  task,
  deadline,
  documentCount,
  contextLabel = task.category,
}: TaskRowProps) {
  return (
    <li
      data-checklist-task={task.id}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 py-3 first:pt-0 last:pb-0 sm:gap-x-5"
    >
      <label className="flex min-h-11 min-w-0 cursor-pointer items-start gap-3 py-2.5">
        <Input
          type="checkbox"
          checked={task.done}
          data-task={task.id}
          aria-label={`${task.task} 완료`}
          className="m-0 mt-1 size-4 shrink-0 cursor-pointer accent-foundy-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary"
        />
        <span
          className={`text-[15px] leading-6 font-medium break-words sm:text-base ${task.done ? "text-neutral-600 line-through decoration-neutral-400" : "text-neutral-900"}`}
        >
          {task.task}
        </span>
      </label>
      <div className="col-start-2 row-start-1 max-w-24 sm:row-span-2 sm:max-w-32">
        <TaskDeadline due={task.due} deadline={deadline} done={task.done} />
      </div>
      <div className="col-span-full ml-7 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 max-[359px]:ml-0 max-[359px]:gap-x-1.5 sm:col-span-1 sm:gap-x-2.5 mb-4">
        <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-[13px] leading-5 font-medium text-neutral-700">
          {contextLabel}
        </span>
        {documentCount > 0 && (
          <button
            type="button"
            data-nx="godocs"
            data-tid={task.id}
            className="before:mr-1 before:h-3 before:w-px before:shrink-0 before:bg-neutral-300 inline-flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent p-0 text-sm font-medium text-foundy-primary-ink hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary"
          >
            서류 안내 {documentCount}개
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>
        )}
        <TaskMetadata task={task} />
      </div>
    </li>
  );
}
