import { WizardStep } from "@/components/onboarding/WizardStep";
import { Element } from "@/components/view/Element";
import { Fragment } from "react";

export interface WizardProgressProps { step: number }

export function WizardProgress({ step }: WizardProgressProps) {
  return (
    <Element className="wizardsteps">
      {["가게 정보", "추가 질문", "분석"].map((label, index) => (
        <Fragment key={label}>
          <WizardStep
            number={index + 1}
            label={label}
            active={index + 1 <= step}
          />
          {index < 2 && <Element as="span" className="stepbar" />}
        </Fragment>
      ))}
    </Element>
  );
}
