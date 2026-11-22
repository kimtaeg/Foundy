"use client";
import { Suspense, type ReactNode } from "react";
import { AccountCard } from "@/components/mypage/AccountCard";
import { BusinessConditionsCard } from "@/components/mypage/BusinessConditionsCard";
import { DataManagementCard } from "@/components/mypage/DataManagementCard";
import { ProfileHeader } from "@/components/mypage/ProfileHeader";
import { ProfileSkeleton } from "@/components/mypage/ProfileSkeleton";
import { ProfileSetupNotice } from "@/components/mypage/ProfileSetupNotice";
import { StoreDetailsCard } from "@/components/mypage/StoreDetailsCard";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataViewProps } from "@/types/data-state";
import type { ProfileViewModel } from "@/types/profile";
import { profileColumns } from "./profile-styles";

export type MypageViewProps = DataViewProps<ProfileViewModel> & { setup?: ReactNode };

export function MypageView({ onEvent, setup, ...state }: MypageViewProps) {
  return (
    <FeatureView page="mypage" onEvent={onEvent}>
      <ProfileHeader />
      <DataBoundary {...state} fallback={<ProfileSkeleton />}>
        {(model) => model.onboarded ? (
          <div className="pt-2 sm:pt-3">
            <div className={profileColumns}>
              <Suspense fallback={<SectionSkeleton appearance="plain" variant="list" label="가게 정보" />}>
                <StoreDetailsCard edit={model.edit} draft={model.draft} />
              </Suspense>
              <Suspense fallback={<SectionSkeleton appearance="plain" variant="list" label="영업 조건" />}>
                <BusinessConditionsCard answers={model.answers} edit={model.edit} draft={model.draft} />
              </Suspense>
            </div>
            <div className={`${profileColumns} mt-8 border-0 border-t border-solid border-neutral-200 pt-7 lg:mt-10 lg:pt-8`}>
              <Suspense fallback={<SectionSkeleton appearance="plain" variant="list" label="계정 정보" rows={1} />}>
                <AccountCard edit={model.edit} profile={model.profile} providerLabel={model.providerLabel} />
              </Suspense>
              <DataManagementCard canReset={model.canReset} />
            </div>
          </div>
        ) : setup ? (
          <div className="pt-2 sm:pt-3">
            <ProfileSetupNotice />
            {setup}
          </div>
        ) : null}
      </DataBoundary>
    </FeatureView>
  );
}
