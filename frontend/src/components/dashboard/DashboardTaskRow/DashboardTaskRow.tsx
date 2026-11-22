import { Input } from "@/components/ui/Input";
import type { DashboardTask } from "@/types/dashboard";

export interface DashboardTaskRowProps {
  task: DashboardTask;
  asOf?: string;
}

export function DashboardTaskRow({ task, asOf }: DashboardTaskRowProps) {
  const validDue = /^\d{4}-\d{2}-\d{2}$/.test(task.due);
  const overdue = Boolean(!task.done && validDue && asOf && task.due < asOf);
  const today = Boolean(!task.done && validDue && asOf && task.due === asOf);
  return (
    <li>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-3">
        <Input type="checkbox" data-task={task.id} aria-label={`${task.task} 완료`}
          checked={task.done}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-foundy-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary" />
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-medium leading-relaxed ${task.done ? "text-neutral-600 line-through" : "text-neutral-900"}`}>{task.task}</span>
          <span className={`mt-1 block text-[13px] leading-relaxed ${overdue ? "text-orange-800" : "text-neutral-600"}`}>
            {validDue ? `${task.due.slice(5).replace("-", ".")} · ${overdue ? "기한 지남" : today ? "오늘까지" : task.group}` : task.group}
          </span>
        </span>
      </label>
    </li>
  );
}
