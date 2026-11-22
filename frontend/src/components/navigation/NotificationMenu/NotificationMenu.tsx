"use client";
import { NotificationButton } from "@/components/navigation/NotificationButton";
import { NotificationPopover } from "@/components/navigation/NotificationPopover";
import { useNotificationPreview } from "@/hooks/useNotificationPreview";
import type { NotificationFetchStatus, NotificationSummary } from "@/types/notifications";
import { createPortal } from "react-dom";
export interface NotificationMenuProps {
  notifications: NotificationSummary[];
  notificationFetch?: NotificationFetchStatus;
  onOpen: (notification: NotificationSummary) => void;
}
export function NotificationMenu({
  notifications,
  notificationFetch,
  onOpen,
}: NotificationMenuProps) {
  const disclosure = useNotificationPreview();
  const unread = notifications.filter((item) => !item.read).length;
  const preview = [...notifications]
    .sort((a, b) => Number(a.read) - Number(b.read))
    .slice(0, 4);

  async function retry() {
    const restoreFocus = disclosure.panelRef.current?.contains(document.activeElement);
    await notificationFetch?.retry();
    if (!restoreFocus) return;
    requestAnimationFrame(() => {
      const panel = disclosure.panelRef.current;
      if (!panel || document.activeElement !== document.body) return;
      (panel.querySelector("button") ?? disclosure.triggerRef.current)?.focus();
    });
  }

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={disclosure.show}
      onMouseLeave={disclosure.scheduleClose}
    >
      <NotificationButton
        unread={unread}
        countKnown={notifications.length > 0 || (!notificationFetch?.loading && !notificationFetch?.error)}
        open={disclosure.open}
        panelId={disclosure.id}
        buttonRef={disclosure.triggerRef}
        onToggle={disclosure.show}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            disclosure.show();
            requestAnimationFrame(() =>
              disclosure.panelRef.current?.querySelector("button")?.focus(),
            );
          }
        }}
      />
      {disclosure.open &&
        createPortal(
          <NotificationPopover
            id={disclosure.id}
            panelRef={disclosure.panelRef}
            notifications={preview}
            notificationFetch={notificationFetch && { ...notificationFetch, retry }}
            position={disclosure.position}
            onOpen={(notification) => {
              disclosure.close();
              onOpen(notification);
            }}
            onMouseEnter={disclosure.cancelClose}
            onMouseLeave={disclosure.scheduleClose}
          />,
          document.body,
        )}
    </div>
  );
}
