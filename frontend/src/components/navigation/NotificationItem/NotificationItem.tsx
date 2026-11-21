import type { NotificationSummary } from "@/types/notifications";
export interface NotificationItemProps {
  notification: NotificationSummary;
  onOpen: (notification: NotificationSummary) => void;
}
export function NotificationItem({
  notification,
  onOpen,
}: NotificationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      data-notification-id={notification.id}
      className="flex w-full cursor-pointer items-start gap-3 rounded-xl border-0 bg-transparent px-3 py-3.5 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-foundy-primary"
    >
      <span
        aria-hidden="true"
        className={`mt-2 size-1.5 shrink-0 rounded-full ${notification.read ? "bg-neutral-300" : "bg-foundy-primary"}`}
      />
      <span className="min-w-0 flex-1">
        <span className="mb-1 block text-xs leading-4 font-semibold text-neutral-700">
          {notification.category}
        </span>
        <span className="block text-sm leading-[1.6] font-bold text-neutral-700">
          {notification.title}
        </span>
        <span className="mt-1 line-clamp-2 block text-sm leading-[1.65] text-neutral-600">
          {notification.body}
        </span>
      </span>
    </button>
  );
}
