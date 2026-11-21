import { NotificationItem } from "@/components/navigation/NotificationItem";
import type { NotificationSummary } from "@/types/notifications";
import { Ref } from "react";
export interface NotificationPopoverProps {
  id: string;
  panelRef: Ref<HTMLElement>;
  unread: number;
  notifications: NotificationSummary[];
  position: { top: number; left: number; width: number };
  onOpen: (notification: NotificationSummary) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}
export function NotificationPopover({
  id,
  panelRef,
  unread,
  notifications,
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
      className="fixed z-[100] overflow-hidden rounded-[20px] border border-solid border-neutral-200 bg-white p-2 shadow-[0_16px_60px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="m-0 text-[16px] leading-6 font-extrabold tracking-tight text-neutral-800">
          알림
        </h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs leading-5 font-semibold text-neutral-700">
          읽지 않음 {unread}
        </span>
      </div>
      <div className="max-h-[min(420px,55vh)] overflow-y-auto">
        {notifications.length ? (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onOpen={onOpen}
            />
          ))
        ) : (
          <p className="m-0 px-4 py-10 text-center text-sm text-neutral-600">
            새로운 알림이 없어요.
          </p>
        )}
      </div>
    </section>
  );
}
