import { Element } from "@/components/view/Element";
import { type NextStep } from "@/types/report";

export type NextStepItemProps = { step: NextStep };

export function NextStepItem({ step }: NextStepItemProps) {
  return (
    <li>
      <div>
        <b>{step.t}</b>
        {step.k === "new" && (
          <>
            {" "}
            <Element as="span" className="nx-badge ok">
              새로 생김
            </Element>
          </>
        )}
        <Element className="nx-muted">{step.s}</Element>
      </div>
      <Element
        as="button"
        className="nx-btn outline slim"
        data-nx="cnav"
        data-p={step.go[0]}
        data-focus={step.go[1] || ""}
      >
        {step.cta} →
      </Element>
    </li>
  );
}
