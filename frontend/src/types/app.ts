import { type ApiModel } from "@/lib/api/contexts";
import { type FoundySnapshot, type FoundyStore } from "@/types/foundy";
import { SyntheticEvent } from "react";

/** Application actions exposed to hooks and shell components. */
export interface FoundyContextValue {
  engine: FoundyStore | null;
  snapshot: FoundySnapshot | null;
  /** 예시 계정을 서버 데이터로 그리는 중이면 API 응답 모델 */
  api: ApiModel | null;
  /** 서버 데이터를 기다리는 중 */
  apiPending: boolean;
  onEvent(type: string, event: SyntheticEvent<HTMLElement>): void;
  navigate(page: string): void;
  logout(): void;
  openNotification(id: string): void;
}
