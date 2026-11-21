import { MetricCard } from "@/components/common/MetricCard";
import { Element } from "@/components/view/Element";

export type DashboardMetricsProps = {
  undecided: boolean;
  decisions: number;
  tasks: { done: number; total: number };
  unread: number;
};

export function DashboardMetrics({
  undecided,
  decisions,
  tasks,
  unread,
}: DashboardMetricsProps) {
  return (
    <Element className="nx-cols3">
      <MetricCard
        label="결정할 사항"
        value={undecided ? "—" : `${decisions}건`}
        caption={undecided ? "자리 확정 후 시작" : "선택지가 있고 아직 결정 전"}
      />
      <MetricCard
        label="체크리스트"
        value={`${tasks.done}/${tasks.total}`}
        caption="완료 / 전체"
      />
      <MetricCard
        label="새 알림"
        value={`${unread}건`}
        caption="알림 센터에서 확인"
      />
    </Element>
  );
}
