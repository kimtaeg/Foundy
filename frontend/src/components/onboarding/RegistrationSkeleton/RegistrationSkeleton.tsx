import { Skeleton } from "@/components/loading/Skeleton";
import { formGrid, stepFooter, wizardLayout, wizardSteps } from "../onboarding-styles";

function FieldPlaceholder({ address = false, hint = false }: { address?: boolean; hint?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${address ? "sm:col-span-2" : ""}`}>
      <Skeleton className="h-5 w-20" />
      <div className="flex gap-2">
        <Skeleton className="h-12 min-w-0 flex-1 rounded-lg" />
        {address && <Skeleton className="h-12 w-18 shrink-0 rounded-lg sm:w-26" />}
      </div>
      {hint && <Skeleton className="h-5 w-56 max-w-full" />}
    </div>
  );
}

function StoreInformationPlaceholder({ demo }: { demo: boolean }) {
  return (
    <>
      <Skeleton className="h-7 w-60 max-w-full" />
      {demo && <Skeleton className="mt-4 h-17 w-full rounded-md" />}
      <div className={`${formGrid} mt-6`}>
        <FieldPlaceholder />
        <FieldPlaceholder />
        <FieldPlaceholder address hint />
        <FieldPlaceholder />
        <FieldPlaceholder />
        <FieldPlaceholder hint />
      </div>
      <div className={`${stepFooter} mt-7 justify-end`}>
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>
    </>
  );
}

function BusinessQuestionsPlaceholder() {
  return (
    <>
      <Skeleton className="h-7 w-52 max-w-full" />
      <Skeleton className="mt-1 h-6 w-80 max-w-full" />
      <div className="mt-6 border-0 border-t border-solid border-neutral-200">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-wrap justify-between gap-3 border-0 border-b border-solid border-neutral-200 py-4">
            <div className="flex min-w-0 flex-1 basis-52 flex-col gap-1">
              <Skeleton className="h-6 w-44 max-w-full" />
              <Skeleton className="h-5 w-56 max-w-full" />
            </div>
            <Skeleton className="h-13 w-31 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="mt-5 sm:max-w-xs"><FieldPlaceholder /></div>
      <div className={`${stepFooter} mt-7 justify-between`}>
        <Skeleton className="h-11 w-18 rounded-lg" />
        <Skeleton className="h-11 w-30 rounded-lg" />
      </div>
    </>
  );
}

function AnalysisPlaceholder({ rows }: { rows: number }) {
  return (
    <>
      <Skeleton className="h-7 w-64 max-w-full" />
      <Skeleton className="mt-2 h-5 w-24" />
      <div className="mt-5 border-0 border-t border-solid border-neutral-200">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-0 border-b border-solid border-neutral-100 py-3 last:border-b-0">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="ml-auto h-7 w-12" />
          </div>
        ))}
      </div>
      <div className={`${stepFooter} mt-5 justify-end`}>
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>
    </>
  );
}

export interface RegistrationSkeletonProps {
  /** A known step loads below the already visible heading and progress indicator. */
  currentStep?: number;
  analysisCount?: number;
  embedded?: boolean;
}

export function RegistrationSkeleton({ currentStep, analysisCount = 0, embedded = false }: RegistrationSkeletonProps = {}) {
  const fullLayout = currentStep === undefined;
  const standalone = fullLayout && !embedded;
  const content = fullLayout || currentStep === 1
    ? <StoreInformationPlaceholder demo={standalone} />
    : currentStep === 2 ? <BusinessQuestionsPlaceholder /> : <AnalysisPlaceholder rows={analysisCount} />;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="가게 등록 정보를 불러오는 중"
      data-skeleton="register"
      data-page-skeleton={standalone ? "register" : undefined}
    >
      {standalone && (
        <div aria-hidden="true" className="mb-5 border-0 border-b border-solid border-neutral-200 pb-6 sm:pb-7">
          <div className="mb-5 flex h-8 items-center"><Skeleton className="h-4 w-24" /></div>
          <Skeleton className="h-9 w-32 sm:h-11" />
          <Skeleton className="mt-3 h-6 w-96 max-w-full" />
        </div>
      )}
      {fullLayout ? (
        <div aria-hidden="true" className={wizardLayout}>
          <div className={`${wizardSteps} border-0 border-b border-solid border-neutral-200 pb-4 lg:border-b-0 lg:pb-0`}>
            {[0, 1, 2].map(index => (
              <div key={index} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 lg:px-2.5 lg:py-2">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <Skeleton className={index === 2 ? "h-5 w-7" : "h-5 w-14"} />
              </div>
            ))}
          </div>
          <div className="min-w-0">{content}</div>
        </div>
      ) : <div aria-hidden="true">{content}</div>}
    </div>
  );
}
