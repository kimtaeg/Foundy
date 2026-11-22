import type { NotificationFetchStatus, NotificationSummary } from "./notifications";
export interface NavigationDestination {
  id: string;
  label: string;
  description?: string;
  group?: "preparation";
}
export interface NavbarData {
  currentPage: string;
  storeName: string;
  notifications: NotificationSummary[];
  notificationFetch?: NotificationFetchStatus;
  destinations?: NavigationDestination[];
  onboarded?: boolean;
}
export interface NavbarProps extends NavbarData {
  onNavigate: (page: string) => void;
  onOpenNotification: (notification: NotificationSummary) => void;
  onLogout: () => void;
}
