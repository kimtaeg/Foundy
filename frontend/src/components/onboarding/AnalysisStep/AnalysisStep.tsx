import { AnalysisStatusItem } from "@/components/common/AnalysisStatusItem";
import { Element } from "@/components/view/Element";

export interface AnalysisStepProps {
  storeName: string;
  steps: string[];
  completed: number[];
  /** 서버 분석의 실제 진행이면 true, 로컬 시뮬레이션이면 false */
  server?: boolean;
  /** 단계 번호 → 실제 상태 문구 (예시·캐시 자료로 대체, 조회 실패 등). 없는 단계는 "완료" */
  notes?: Record<number, string>;
}

export function AnalysisStep({
  storeName,
  steps,
  completed,
  server = false,
  notes = {},
}: AnalysisStepProps) {
  const finished = completed.length >= steps.length;
  const substituted = Object.keys(notes).length > 0;
  return (
    <Element className="panel">
      <Element className="nx-heading">
        <Element as="h2" className="section-title" style={{ margin: 0 }}>
          {storeName}의 창업 준비 사항을 분석하고 있어요
        </Element>
        {!server && (
          <Element as="span" className="nx-badge">
            시뮬레이션
          </Element>
        )}
      </Element>
      <Element as="p" className="smallmuted">
        {server
          ? "서버가 알려 주는 실제 진행이에요. 예시·캐시 자료로 대체되거나 조회에 실패한 단계는 숨기지 않고 표시해요."
          : "실제 서비스에서는 서버 진행 이벤트(SSE)가 이 목록을 채워요. 연결이 끊기면 상태 조회로 이어서 보여줘요."}
      </Element>
      <Element className="analysis-list">
        {steps.map((label, index) => (
          <AnalysisStatusItem
            key={label}
            label={label}
            index={index}
            complete={completed.includes(index)}
            completeLabel={notes[index] ?? "완료"}
            running={!completed.includes(index) && completed.length === index}
          />
        ))}
      </Element>
      {server && finished && substituted && (
        <Element className="nx-note" style={{ marginBottom: 12 }}>
          일부 단계는 실제 조회 대신 예시·캐시 자료를 썼거나 조회하지 못했어요. 그 단계에 기대는 점검 결과는 실제와 다를 수 있으니 점검 리포트에서 표시를 확인하세요.
        </Element>
      )}
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
