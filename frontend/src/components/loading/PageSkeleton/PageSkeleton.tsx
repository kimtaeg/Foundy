import { ChecklistSkeleton } from "@/components/checklist/ChecklistSkeleton";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DocsHeader } from "@/components/docs/DocsHeader";
import { DocsSkeleton } from "@/components/docs/DocsSkeleton";
import { GrantsSkeleton } from "@/components/grants/GrantsSkeleton";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { LoginSkeleton } from "@/components/login/LoginSkeleton";
import { ProfileHeader } from "@/components/mypage/ProfileHeader";
import { ProfileSkeleton } from "@/components/mypage/ProfileSkeleton";
import { RegistrationSkeleton } from "@/components/onboarding/RegistrationSkeleton";
import { ReportSkeleton } from "@/components/report/ReportSkeleton";
import { SitesSkeleton } from "@/components/sites/SitesSkeleton";
import type { ApplicationPage } from "@/types/routes";
import type { ReactElement } from "react";

const skeletons = {
  dashboard: <DashboardSkeleton />,
  report: <ReportSkeleton />,
  checklist: <ChecklistSkeleton />,
  docs: <><DocsHeader /><DocsSkeleton /></>,
  grants: <GrantsSkeleton />,
  sites: <SitesSkeleton />,
  mypage: <><ProfileHeader /><ProfileSkeleton /></>,
  login: <LoginSkeleton />,
  register: <RegistrationSkeleton />,
  chat: <SectionSkeleton variant="chat" label="상담 내용을 불러오는 중" rows={4} />,
} satisfies Record<ApplicationPage, ReactElement>;

export interface PageSkeletonProps {
  page: ApplicationPage;
}

export function PageSkeleton({ page }: PageSkeletonProps) {
  return skeletons[page];
}
