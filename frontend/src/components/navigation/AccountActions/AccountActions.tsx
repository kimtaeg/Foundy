import { LogoutButton } from "@/components/navigation/LogoutButton";
import { NotificationMenu } from "@/components/navigation/NotificationMenu";
import { StoreIdentity } from "@/components/navigation/StoreIdentity";
import type { NotificationSummary } from "@/types/notifications";
export interface AccountActionsProps {
  storeName: string;
  notifications: NotificationSummary[];
  onOpenNotification: (notification: NotificationSummary) => void;
  onOpenStore: () => void;
  onLogout: () => void;
}
export function AccountActions({
  storeName,
  notifications,
  onOpenNotification,
  onOpenStore,
  onLogout,
}: AccountActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
      <NotificationMenu
        notifications={notifications}
        onOpen={onOpenNotification}
      />
      <span
        aria-hidden="true"
        className="mx-1 hidden h-5 w-px bg-neutral-200 sm:block"
      />
      <StoreIdentity name={storeName} onOpen={onOpenStore} />
      <LogoutButton onLogout={onLogout} />
    </div>
  );
}
