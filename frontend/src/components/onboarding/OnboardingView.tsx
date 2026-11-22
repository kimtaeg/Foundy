"use client";
import { Suspense, useEffect, useRef } from "react";
import { AnalysisStep } from "@/components/onboarding/AnalysisStep";
import { BusinessQuestionsStep } from "@/components/onboarding/BusinessQuestionsStep";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { RegistrationSkeleton } from "@/components/onboarding/RegistrationSkeleton";
import { StoreInformationStep } from "@/components/onboarding/StoreInformationStep";
import { WizardProgress } from "@/components/onboarding/WizardProgress";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { EventBoundary } from "@/components/view/EventBoundary";
import { FeatureView } from "@/components/view/FeatureView";
import type { DataViewProps } from "@/types/data-state";
import type { OnboardingViewModel } from "@/types/onboarding";
import { wizardLayout } from "./onboarding-styles";

export type OnboardingViewProps = DataViewProps<OnboardingViewModel> & { embedded?: boolean };

function OnboardingFlow({ model, embedded }: { model: OnboardingViewModel; embedded: boolean }) {
  const content = useRef<HTMLDivElement>(null);
  const previousStep = useRef(model.step);
  useEffect(() => {
    if (previousStep.current === model.step) return;
    previousStep.current = model.step;
    content.current?.querySelector("h2")?.focus();
  }, [model.step]);

  return (
    <>
      {!embedded && <OnboardingHeader returning={model.store.onboarded} userName={model.userName} />}
      <div className={wizardLayout}>
        <WizardProgress step={model.step} />
        <div ref={content} className="min-w-0">
          <Suspense fallback={<RegistrationSkeleton currentStep={model.step} analysisCount={model.analysisSteps.length} />}>
            {model.step === 1 ? (
              <StoreInformationStep store={model.store} saving={model.saving} showDemo={!model.answers} />
            ) : model.step === 2 ? (
              <BusinessQuestionsStep store={model.store} answers={model.answers} analysisFailed={model.analysisFailed} />
            ) : (
              <AnalysisStep storeName={model.store.name} steps={model.analysisSteps} completed={model.completed} notes={model.notes} finished={model.finished} />
            )}
          </Suspense>
        </div>
      </div>
    </>
  );
}

export function OnboardingView({ onEvent, embedded = false, ...state }: OnboardingViewProps) {
  const content = (
    <DataBoundary {...state} fallback={<RegistrationSkeleton embedded={embedded} />}>
      {model => <OnboardingFlow model={model} embedded={embedded} />}
    </DataBoundary>
  );
  return embedded ? <EventBoundary onEvent={onEvent}>{content}</EventBoundary> : (
    <FeatureView page="register" onEvent={onEvent}>{content}</FeatureView>
  );
}
