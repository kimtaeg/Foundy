import { Element } from "@/components/view/Element";

export type AnalysisStatusItemProps = {
  label: string;
  index: number;
  complete: boolean;
  running: boolean;
  completeLabel?: string;
};

export function AnalysisStatusItem({
  label,
  index,
  complete,
  running,
  completeLabel = "완료",
}: AnalysisStatusItemProps) {
  return (
    <Element
      className={`analysis-item ${complete ? "done" : running ? "running" : ""}`}
    >
      <Element as="span" className="circle">
        {complete ? "✓" : running ? "…" : index + 1}
      </Element>
      <div>{label}</div>
      <Element as="span" className="status">
        {complete ? completeLabel : running ? "진행 중" : "대기"}
      </Element>
    </Element>
  );
}
