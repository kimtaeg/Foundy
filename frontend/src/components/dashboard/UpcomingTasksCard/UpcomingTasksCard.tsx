import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardCardLink } from "@/components/dashboard/DashboardCardLink";
import { DashboardSectionHeader } from "@/components/dashboard/DashboardSectionHeader";
import { DashboardTaskRow } from "@/components/dashboard/DashboardTaskRow";
import { ReportActionCallout } from "@/components/dashboard/ReportActionCallout";
import type { DashboardAction, DashboardTask } from "@/types/dashboard";

export interface UpcomingTasksCardProps {
  tasks: DashboardTask[];
  actions: DashboardAction[];
  asOf?: string;
  className?: string;
}

export function UpcomingTasksCard({ tasks, actions, asOf, className = "" }: UpcomingTasksCardProps) {
  const previewTasks = [...tasks]
    .sort((a, b) => (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99"))
    .slice(0, 3);
  const nextAction = actions[0];
  return (
    <DashboardCard className={className} label="다음 할 일">
      <DashboardSectionHeader
        title="다음 할 일"
        action={<DashboardCardLink page="checklist" className="-my-2">체크리스트 보기</DashboardCardLink>}
      />
      {nextAction && <ReportActionCallout action={nextAction} />}
      {previewTasks.length ? (
        <ul className="m-0 list-none divide-y divide-neutral-100 p-0">
          {previewTasks.map((task) => <DashboardTaskRow key={task.id} task={task} asOf={asOf} />)}
        </ul>
      ) : (
        <p className="my-6 text-sm leading-relaxed text-neutral-600">남은 할 일이 없어요. 체크리스트에서 다음 준비 항목을 확인해 보세요.</p>
      )}
    </DashboardCard>
  );
}
