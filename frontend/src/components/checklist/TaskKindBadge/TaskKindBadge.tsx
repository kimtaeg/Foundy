import { Element } from "@/components/view/Element";
import type { TaskKind } from "@/types/checklist";

export interface TaskKindBadgeProps {
  kind?: TaskKind;
  aiAdded?: boolean;
}

const KIND: Record<TaskKind, { label: string; tone: string }> = {
  legal_obligation: { label: "필수", tone: "high" },
  conditional: { label: "조건부", tone: "low" },
  preparation: { label: "권장", tone: "" },
};

/** 작업의 성격(필수·조건부·권장)과 AI 분석에서 새로 발견한 작업인지 보여 준다. 로컬 예시에는 표시하지 않는다. */
export function TaskKindBadge({ kind, aiAdded }: TaskKindBadgeProps) {
  if (!kind) return null;
  const { label, tone } = KIND[kind];
  return (
    <Element as="span" className="nx-badges" style={{ display: "inline-flex", marginRight: 6 }}>
      <Element as="span" className={`nx-badge ${tone}`.trim()}>
        {label}
      </Element>
      {aiAdded && (
        <Element as="span" className="nx-badge ok">
          AI 분석에서 추가됨
        </Element>
      )}
    </Element>
  );
}
