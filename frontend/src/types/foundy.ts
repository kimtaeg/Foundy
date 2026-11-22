import { type ApplicationDialog } from "@/types/dialog";
import type { SignInHandler, SignUpHandler } from "@/types/auth";
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
  toastId: number;
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
  restoreSession(): Promise<void>;
  retrySetup(): void;
  adoptServerStore(next: import("./store").Store): void;
  signIn: SignInHandler;
  signUp: SignUpHandler;
  navigate(page: string): void;
  openChat(): void;
  closeModal(): void;
  logout(message?: string): void;
  openNotification(id: string): void;
  destroy(): void;
}
