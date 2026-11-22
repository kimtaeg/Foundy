import { BusinessQuestion } from "@/components/onboarding/BusinessQuestion";
import { Input } from "@/components/ui/Input";
import type { OnboardingAnswers, OnboardingStore } from "@/types/onboarding";
import { fieldControl, fieldLabel, numberField, primaryAction, secondaryAction, stepFooter, stepTitle } from "../onboarding-styles";

export interface BusinessQuestionsStepProps {
  store: OnboardingStore;
  answers?: OnboardingAnswers;
  analysisFailed?: boolean;
}

export function BusinessQuestionsStep({ store, answers, analysisFailed }: BusinessQuestionsStepProps) {
  const missing = answers ? Object.values(answers).some(value => value === null) : false;

  return (
    <section aria-labelledby="business-questions-title" className="min-w-0">
      <h2 id="business-questions-title" tabIndex={-1} className={stepTitle}>어떤 조건으로 운영하실 계획인가요?</h2>
      <p className="mb-0 mt-1 text-sm leading-6 text-neutral-600">영업 조건에 맞춰 신고 절차와 준비 항목을 안내해 드려요.</p>
      {analysisFailed && (
        <p role="status" className="mb-0 mt-4 border-0 border-l-2 border-solid border-amber-500 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
          이전 점검을 마치지 못했어요. 영업 조건을 확인하고 다시 시도해 주세요.
        </p>
      )}
      <div className="mt-6">
        <BusinessQuestion field="alcohol" title="술도 판매하시나요?" description="주류 판매 여부에 따라 신고 업종이 달라질 수 있어요." value={answers ? answers.alcohol : store.alcohol} />
        <BusinessQuestion field="terrace" title="테라스나 가게 앞 공간을 사용하시나요?" description="옥외영업 관련 확인이 필요할 수 있어요." value={answers ? answers.terrace : store.terrace} />
        <BusinessQuestion field="employees" title="직원을 고용하시나요?" description="근로계약과 4대보험 준비 일정에 반영해요." value={answers ? answers.employees : store.employees} />
      </div>
      <label className={`${fieldLabel} mt-5 sm:max-w-xs`}>
        <span>준비 자금 <span className="font-normal text-neutral-600">(선택)</span></span>
        <span className="relative block">
          <Input id="fFunds" className={`${fieldControl} ${numberField} pr-10`} type="number" inputMode="numeric" min={0} step={1} value={store.funds ?? ""} placeholder="금액을 입력해 주세요" aria-describedby="business-funds-unit" />
          <span id="business-funds-unit" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-600">원</span>
        </span>
      </label>
      {missing && <p className="mb-0 mt-4 text-sm text-neutral-600" id="required-business-answers">영업 조건 세 가지를 모두 선택해 주세요.</p>}
      <div className={`${stepFooter} mt-7 justify-between`}>
        <button type="button" className={secondaryAction} data-nx="wizback"><span aria-hidden="true">←</span> 이전</button>
        <button type="button" className={primaryAction} data-nx="analyze" disabled={missing} aria-describedby={missing ? "required-business-answers" : undefined}>
          AI 점검 시작 <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
