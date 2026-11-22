export interface TaskDeadlineProps {
  due: string;
  deadline: string;
  done: boolean;
}

export function TaskDeadline({ due, deadline, done }: TaskDeadlineProps) {
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(due)
    ? due.slice(5).replace("-", ".")
    : due || "기한 미정";
  return (
    <div className="flex flex-col items-end gap-1 pt-2.5 text-right text-[15px] leading-5 break-words text-neutral-600 tabular-nums">
      <span
        className="font-semibold text-neutral-800"
        aria-label={due ? `기한 ${due}` : "기한 미정"}
      >
        {dateLabel}
      </span>
      {done ? (
        <span className="rounded-full bg-foundy-primary/10 px-2 py-0.5 text-[13px] font-semibold text-foundy-primary-ink">
          완료
        </span>
      ) : (
        deadline && (
          <span className="max-w-full rounded-full bg-neutral-100 px-2 py-0.5 text-[13px] font-medium text-neutral-700">
            {deadline}
          </span>
        )
      )}
    </div>
  );
}
