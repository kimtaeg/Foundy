import { AnalysisStatusItem } from "@/components/common/AnalysisStatusItem";
import { Element } from "@/components/view/Element";

export interface AnalysisProgressDialogProps {
  steps: string[];
  completed: number;
  changes: string[];
}

export function AnalysisProgressDialog({
  steps,
  completed,
  changes,
}: AnalysisProgressDialogProps) {
  return (
    <>
      <Element className="analysis-list">
        {steps.map((label, index) => (
          <AnalysisStatusItem
            key={index}
            label={label}
            index={index}
            complete={index < completed}
            running={index === completed}
          />
        ))}
      </Element>
      {completed >= steps.length && (
        <>
          <Element className="nx-ok">✓ 다시 반영을 마쳤어요</Element>
          <Element as="ul" className="nx-ul">
            {changes.map((change, index) => (
              <li key={index}>{change}</li>
            ))}
          </Element>
        </>
      )}
    </>
  );
}
