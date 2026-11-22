import { Skeleton } from "@/components/loading/Skeleton";
import { NotificationItem } from "@/components/navigation/NotificationItem";
import type { NotificationFetchStatus, NotificationSummary } from "@/types/notifications";
import { Ref } from "react";
export interface NotificationPopoverProps {
  id: string;
  panelRef: Ref<HTMLElement>;
  notifications: NotificationSummary[];
  notificationFetch?: NotificationFetchStatus;
  position: { top: number; left: number; width: number };
  onOpen: (notification: NotificationSummary) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}
export function NotificationPopover({
  id,
  panelRef,
  notifications,
  notificationFetch,
  position,
  onOpen,
  onMouseEnter,
  onMouseLeave,
}: NotificationPopoverProps) {
  return (
    <section
      id={id}
      ref={panelRef}
      role="dialog"
      aria-label="알림 요약"
      style={position}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-[100] overflow-hidden rounded-xl border border-solid border-neutral-200 bg-white opacity-100 shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-[opacity,translate] duration-[180ms] ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none"
    >
      <ul className="m-0 max-h-[min(420px,55vh)] list-none overflow-y-auto overscroll-contain p-2">
        {notificationFetch?.error && (
          <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-0 border-b border-solid border-neutral-100 px-3 py-3 text-sm last:border-b-0">
            <p role="alert" className="m-0 min-w-0 flex-1 break-words text-neutral-700">{notificationFetch.error}</p>
            <button
              type="button"
              aria-disabled={notificationFetch.loading}
              onClick={() => {
                if (!notificationFetch.loading) void notificationFetch.retry();
              }}
              className="shrink-0 cursor-pointer rounded-md bg-transparent px-2 py-2 font-semibold text-foundy-primary-ink hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-foundy-primary aria-disabled:cursor-default aria-disabled:text-neutral-500"
            >
              다시 시도
            </button>
          </li>
        )}
        {notifications.map((notification) => (
          <li key={notification.id} className="border-0 border-b border-solid border-neutral-100 py-0.5 first:pt-0 last:border-b-0 last:pb-0">
            <NotificationItem notification={notification} onOpen={onOpen} />
          </li>
        ))}
        {!notifications.length && (notificationFetch?.loading ? (
          <li className="px-3 py-4">
            <div role="status" aria-label="알림을 불러오는 중">
              <div aria-hidden="true" className="grid gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          </li>
        ) : !notificationFetch?.error && (
          <li className="px-3 py-8 text-center text-sm text-neutral-600">새로운 알림이 없어요.</li>
        ))}
      </ul>
    </section>
  );
}
