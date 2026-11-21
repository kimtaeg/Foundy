import type { NotificationSummary } from "./notifications";
export interface NavigationDestination {
  id: string;
  label: string;
}
export interface NavbarData {
  currentPage: string;
  storeName: string;
  notifications: NotificationSummary[];
  destinations?: NavigationDestination[];
  onboarded?: boolean;
}
export interface NavbarProps extends NavbarData {
  onNavigate: (page: string) => void;
  onOpenNotification: (notification: NotificationSummary) => void;
  onLogout: () => void;
}
