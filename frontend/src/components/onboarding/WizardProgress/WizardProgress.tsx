import { WizardStep } from "@/components/onboarding/WizardStep";
import { wizardSteps } from "../onboarding-styles";

export interface WizardProgressProps { step: number }

const labels = ["가게 정보", "영업 조건", "분석"];

export function WizardProgress({ step }: WizardProgressProps) {
  return (
    <nav aria-label="가게 등록 진행 단계" className="border-0 border-b border-solid border-neutral-200 pb-4 lg:border-b-0 lg:pb-0">
      <ol className={wizardSteps}>
        {labels.map((label, index) => (
          <WizardStep key={label} number={index + 1} label={label} current={index + 1 === step} complete={index + 1 < step} />
        ))}
      </ol>
    </nav>
  );
}
