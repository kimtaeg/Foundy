import { DashboardCardLink } from "@/components/dashboard/DashboardCardLink";
import type { ReportCardData } from "@/types/report";

export interface PriorityDecisionContentProps {
  card: Pick<ReportCardData, "id" | "stage" | "title">;
}

export function PriorityDecisionContent({ card }: PriorityDecisionContentProps) {
  return (
    <div className="w-full min-w-0">
      <p className="mb-1.5 mt-0 text-sm font-medium text-foundy-primary-ink">{card.stage}</p>
      <h3 className="m-0 break-keep text-balance text-xl font-semibold leading-snug tracking-tight text-neutral-900">{card.title}</h3>
      <DashboardCardLink page="report" focusId={card.id} className="mt-1">선택지 확인</DashboardCardLink>
    </div>
  );
}
