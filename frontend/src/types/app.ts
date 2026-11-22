import type { ApiResource, ApiResources, ApiSetup } from "@/lib/api/types";
import type { ApiModel } from "@/lib/api/contexts";
import { type FoundySnapshot, type FoundyStore } from "@/types/foundy";
import type { ApplicationPage } from "@/types/routes";
import type { SignInHandler, SignUpHandler } from "@/types/auth";
import type { ChatLaunch } from "@/types/chat";
import { SyntheticEvent } from "react";

/** Application actions exposed to hooks and shell components. */
export interface FoundyContextValue {
  api: ApiModel | null;
  apiActive: boolean;
  setup: ApiSetup | null;
  apiPending: boolean;
  apiError: string | null;
  notificationError: string | null;
  notificationsLoading: boolean;
  retryNotifications(): Promise<void>;
  refreshApi(keys?: readonly ApiResource[]): Promise<ApiModel | null>;
  updateApi<K extends ApiResource>(key: K, change: (value: ApiResources[K]) => ApiResources[K], invalidateMissing?: boolean, preserveInvalidation?: boolean): void;
  closeModal(): void;
  startupError: string | null;
  retryStartup(): void;
  engine: FoundyStore | null;
  snapshot: FoundySnapshot | null;
  chatLaunch: ChatLaunch | null;
  pendingPage: ApplicationPage | null;
  onEvent(type: string, event: SyntheticEvent<HTMLElement>): void;
  signIn: SignInHandler;
  signUp: SignUpHandler;
  navigate(page: string): void;
  logout(): void;
  openNotification(id: string): void;
}
