import { Element } from "@/components/view/Element";

export interface WizardStepProps {
  number: number;
  label: string;
  active: boolean;
}

export function WizardStep({
  number,
  label,
  active,
}: WizardStepProps) {
  return (
    <Element className={`wizardstep ${active ? "active" : ""}`}>
      <b>{number}</b> {label}
    </Element>
  );
}
