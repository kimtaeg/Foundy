import { type ApplicationDialog, type DialogContent } from "@/types/dialog";
import {
  type FeatureContextMap,
  type FeatureContextPage,
} from "@/types/features";
import type { NotificationSummary } from "./notifications";

export interface FoundySnapshot {
  notifications: NotificationSummary[];
  chatOpen: boolean;
  uid: string | null;
  onboarded: boolean;
  currentPage: string;
  modal: ApplicationDialog | null;
  toast: string;
  userName: string;
  storeName: string;
}

export interface FoundyStore {
  getViewContext<Page extends FeatureContextPage>(
    page: Page,
  ): FeatureContextMap[Page];
  handleEvent(
    type: string,
    event: {
      target: EventTarget;
      key?: string;
      preventDefault(): void;
    },
  ): void;
  getSnapshot(): FoundySnapshot;
  navigate(page: string): void;
  closeModal(): void;
  showModal(title: string, content: DialogContent): void;
  showToast(message: string): void;
  navigateTo(page: string): void;
  logout(): void;
  openNotification(id: string): void;
  destroy(): void;
}
