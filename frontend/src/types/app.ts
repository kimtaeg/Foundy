import { type ApiModel } from "@/lib/api/contexts";
import { type FoundySnapshot, type FoundyStore } from "@/types/foundy";
import { type ProfileViewModel } from "@/types/profile";
import { SyntheticEvent } from "react";

/** Application actions exposed to hooks and shell components. */
export interface FoundyContextValue {
  engine: FoundyStore | null;
  snapshot: FoundySnapshot | null;
  /** 예시 계정을 서버 데이터로 그리는 중이면 API 응답 모델 */
  api: ApiModel | null;
  /** 서버 데이터를 기다리는 중 */
  apiPending: boolean;
  /** 서버 연결 모드에서 마이페이지 화면 모델을 서버 저장값·미리보기 기준으로 바꾼다 (없으면 로컬 데모 계산) */
  profileView?: ((local: ProfileViewModel) => ProfileViewModel) | null;
  onEvent(type: string, event: SyntheticEvent<HTMLElement>): void;
  navigate(page: string): void;
  logout(): void;
  openNotification(id: string): void;
}
