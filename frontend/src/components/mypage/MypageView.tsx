"use client";
import { Suspense } from "react";
import { AccountCard } from "@/components/mypage/AccountCard";
import { BusinessConditionsCard } from "@/components/mypage/BusinessConditionsCard";
import { DataManagementCard } from "@/components/mypage/DataManagementCard";
import { ImpactCard } from "@/components/mypage/ImpactCard";
import { ProfileHeader } from "@/components/mypage/ProfileHeader";
import { StoreDetailsCard } from "@/components/mypage/StoreDetailsCard";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { Element } from "@/components/view/Element";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataViewProps } from "@/types/data-state";
import type { ProfileViewModel } from "@/types/profile";

export type MypageViewProps = DataViewProps<ProfileViewModel>;

export function MypageView({ onEvent, ...state }: MypageViewProps) {
  return (
    <FeatureView page="mypage" onEvent={onEvent}>
      <ProfileHeader />
      <DataBoundary {...state} fallback={<PageSkeleton page="mypage" />}>
        {(model) => model.onboarded ? (
          <Element className="nx-wrap">
            <Suspense fallback={<SectionSkeleton variant="card" label="계정 정보" />}>
              <AccountCard profile={model.profile} providerLabel={model.providerLabel} />
            </Suspense>
            <Suspense fallback={<SectionSkeleton variant="form" label="가게 정보" />}>
              <StoreDetailsCard draft={model.draft} fields={model.fields} impacts={model.impacts} regions={model.regions} />
            </Suspense>
            <Suspense fallback={<SectionSkeleton variant="form" label="영업 조건" />}>
              <BusinessConditionsCard draft={model.draft} fields={model.fields} impacts={model.impacts} />
            </Suspense>
            <Suspense fallback={<SectionSkeleton variant="list" label="변경 영향" />}>
              <ImpactCard changes={model.changes} affectedLabels={model.affectedLabels} resetCards={model.resetCards} />
            </Suspense>
            <DataManagementCard />
          </Element>
        ) : null}
      </DataBoundary>
    </FeatureView>
  );
}
