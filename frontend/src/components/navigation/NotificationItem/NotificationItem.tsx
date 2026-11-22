import { NotificationCategoryBadge } from "@/components/navigation/NotificationCategoryBadge";
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
      className="block w-full cursor-pointer rounded-lg border-0 bg-transparent px-3 py-3 text-left transition-colors hover:bg-foundy-primary/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foundy-primary motion-reduce:transition-none [-webkit-tap-highlight-color:transparent]"
    >
      <span className="block min-w-0">
        <span className="mb-1 flex items-center gap-1.5">
          <NotificationCategoryBadge category={notification.category} />
          <span className="sr-only">{notification.read ? "읽음" : "읽지 않음"}</span>
        </span>
        <span className={`line-clamp-2 text-[15px] font-semibold leading-6 ${notification.read ? "text-neutral-600" : "text-neutral-900"}`}>
          {notification.title}
        </span>
        {notification.body && (
          <span className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-neutral-600">
            {notification.body}
          </span>
        )}
      </span>
    </button>
  );
}
