import { MetricCard } from "@/components/common/MetricCard";
import { Element } from "@/components/view/Element";

export interface DocsSummaryProps {
  total: number;
  finished: number;
  remaining: number;
}
export function DocsSummary({ total, finished, remaining }: DocsSummaryProps) {
  return (
    <Element className="nx-cols4">
      <MetricCard label="전체 서류" value={`${total}개`} />
      <MetricCard label="완료한 항목의 서류" value={`${finished}개`} />
      <MetricCard label="아직 남은 서류" value={`${remaining}개`} />
    </Element>
  );
}
