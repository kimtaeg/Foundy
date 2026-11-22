import { type ChatContext } from "@/types/chat";
import { type ChecklistContext } from "@/types/checklist";
import { type DashboardContext } from "@/types/dashboard";
import { type DocsContext } from "@/types/documents";
import { type GrantsContext } from "@/types/grant-view";
import { type SitesContext } from "@/types/market";
import { type OnboardingContext } from "@/types/onboarding";
import { type ProfileContext } from "@/types/profile";
import { type ReportContext } from "@/types/report";

/** Page data contracts shared by the store and view hooks. */
export interface FeatureContextMap {
  dashboard: DashboardContext;
  report: ReportContext;
  checklist: ChecklistContext;
  docs: DocsContext;
  grants: GrantsContext;
  sites: SitesContext;
  chat: ChatContext;
  mypage: ProfileContext;
  register: OnboardingContext;
}

export type FeatureContextPage = keyof FeatureContextMap;
export type FeatureContextFactories = {
  [Page in FeatureContextPage]: () => FeatureContextMap[Page];
};
