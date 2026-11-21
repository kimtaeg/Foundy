"use client";
import { Suspense } from "react";
import { AnalysisStep } from "@/components/onboarding/AnalysisStep";
import { BusinessQuestionsStep } from "@/components/onboarding/BusinessQuestionsStep";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { StoreInformationStep } from "@/components/onboarding/StoreInformationStep";
import { WizardProgress } from "@/components/onboarding/WizardProgress";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { Element } from "@/components/view/Element";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataViewProps } from "@/types/data-state";
import type { OnboardingViewModel } from "@/types/onboarding";

export type OnboardingViewProps = DataViewProps<OnboardingViewModel>;

export function OnboardingView({ onEvent, ...state }: OnboardingViewProps) {
  return (
    <FeatureView page="register" onEvent={onEvent}>
      <DataBoundary {...state} fallback={<PageSkeleton page="register" />}>
        {(model) => (
          <Element className="register">
            <OnboardingHeader returning={model.store.onboarded} userName={model.userName} />
            <WizardProgress step={model.step} />
            <Suspense fallback={<SectionSkeleton variant="form" label="가게 등록 정보" />}>
              {model.step === 1 ? (
                <StoreInformationStep store={model.store} />
              ) : model.step === 2 ? (
                <BusinessQuestionsStep store={model.store} />
              ) : (
                <AnalysisStep storeName={model.store.name} steps={model.analysisSteps} completed={model.completed} server={model.server} notes={model.notes} />
              )}
            </Suspense>
          </Element>
        )}
      </DataBoundary>
    </FeatureView>
  );
}
