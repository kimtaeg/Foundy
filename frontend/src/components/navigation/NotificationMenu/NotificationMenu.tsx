"use client";
import { NotificationButton } from "@/components/navigation/NotificationButton";
import { NotificationPopover } from "@/components/navigation/NotificationPopover";
import { useNotificationPreview } from "@/hooks/useNotificationPreview";
import type { NotificationSummary } from "@/types/notifications";
import { createPortal } from "react-dom";
export interface NotificationMenuProps {
  notifications: NotificationSummary[];
  onOpen: (notification: NotificationSummary) => void;
}
export function NotificationMenu({
  notifications,
  onOpen,
}: NotificationMenuProps) {
  const disclosure = useNotificationPreview();
  const unread = notifications.filter((item) => !item.read).length;
  const preview = [...notifications]
    .sort((a, b) => Number(a.read) - Number(b.read))
    .slice(0, 4);
  return (
    <div
      className="relative shrink-0"
      onMouseEnter={disclosure.show}
      onMouseLeave={disclosure.scheduleClose}
    >
      <NotificationButton
        unread={unread}
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
            unread={unread}
            notifications={preview}
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
