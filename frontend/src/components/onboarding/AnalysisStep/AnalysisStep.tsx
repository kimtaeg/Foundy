import { AnalysisStatusItem } from "@/components/common/AnalysisStatusItem";
import { Element } from "@/components/view/Element";

export interface AnalysisStepProps {
  storeName: string;
  steps: string[];
  completed: number[];
}

export function AnalysisStep({
  storeName,
  steps,
  completed,
}: AnalysisStepProps) {
  const finished = completed.length >= steps.length;
  return (
    <Element className="panel">
      <Element className="nx-heading">
        <Element as="h2" className="section-title" style={{ margin: 0 }}>
          {storeName}의 창업 준비 사항을 분석하고 있어요
        </Element>
        <Element as="span" className="nx-badge">
          시뮬레이션
        </Element>
      </Element>
      <Element as="p" className="smallmuted">
        실제 서비스에서는 서버 진행 이벤트(SSE)가 이 목록을 채워요. 연결이
        끊기면 상태 조회로 이어서 보여줘요.
      </Element>
      <Element className="analysis-list">
        {steps.map((label, index) => (
          <AnalysisStatusItem
            key={label}
            label={label}
            index={index}
            complete={completed.includes(index)}
            completeLabel={
              index === 3 ? "저장된 조문으로 대체 (fallback)" : "완료"
            }
            running={!completed.includes(index) && completed.length === index}
          />
        ))}
      </Element>
      <Element
        as="button"
        className="nx-btn"
        data-nx="finish"
        disabled={!finished}
      >
        {finished ? "내 가게 홈으로 →" : "분석 중…"}
      </Element>
    </Element>
  );
}
