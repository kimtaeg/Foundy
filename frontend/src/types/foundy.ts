import { type ApplicationDialog, type DialogContent } from "@/types/dialog";
import {
  type FeatureContextMap,
  type FeatureContextPage,
} from "@/types/features";
import type { NotificationSummary } from "./notifications";
import type { Store } from "./store";

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
  /** 서버에 저장된 가게로 로컬 가게 정보를 맞추고 가게 등록을 마친 상태로 만든다 */
  adoptServerStore(store: Store): void;
  /** 서버 분석 진행(끝난 단계 번호들)과 예시·실패 등 단계별 실제 상태 문구를 가게 등록 화면에 표시한다 */
  setAnalysisProgress(done: number[], notes?: Record<number, string>): void;
  navigateTo(page: string): void;
  logout(): void;
  openNotification(id: string): void;
  destroy(): void;
}
