import { Input } from "@/components/ui/Input";
import { type CalendarEvent } from "@/types/checklist";

export type CalendarEventRowProps = { event: CalendarEvent; color: string };

export function CalendarEventRow({ event, color }: CalendarEventRowProps) {
  const content = (
    <>
      {event.kind === "task" ? (
        <Input
          type="checkbox"
          data-task={event.id}
          checked={event.done}
          aria-label={`${event.t} 완료`}
          className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-foundy-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foundy-primary"
        />
      ) : (
        <span
          aria-hidden="true"
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span
          className={`text-[15px] leading-6 font-medium break-words sm:text-base ${event.done ? "text-neutral-600 line-through decoration-neutral-400" : "text-neutral-900"}`}
        >
          {event.t}
        </span>
        <span className="text-[13px] leading-5 text-neutral-600 sm:text-sm">
          {event.cat}
        </span>
      </span>
    </>
  );

  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      {event.kind === "task" ? (
        <label className="flex min-h-18 cursor-pointer items-start gap-3 py-5">
          {content}
        </label>
      ) : (
        <div className="flex min-h-18 items-start gap-3 py-5">{content}</div>
      )}
    </div>
  );
}
