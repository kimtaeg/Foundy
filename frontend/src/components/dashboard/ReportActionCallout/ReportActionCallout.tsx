import { DashboardCardLink } from "@/components/dashboard/DashboardCardLink";
import type { DashboardAction } from "@/types/dashboard";

export interface ReportActionCalloutProps {
  action: DashboardAction;
}

export function ReportActionCallout({ action }: ReportActionCalloutProps) {
  return (
    <blockquote className="m-0 mb-4 rounded-r-lg border-0 border-l-[3px] border-solid border-foundy-primary bg-foundy-primary/5 px-4 py-3">
      <p className="mb-0 mt-2 text-sm font-medium text-neutral-900">리포트에서 이어서 할 일</p>
      <p className="m-0 break-words text-base font-semibold leading-relaxed text-neutral-900">{action.action.text}</p>
      <DashboardCardLink page="report" focusId={action.id} className="mt-1 px-0 py">내용 확인</DashboardCardLink>
    </blockquote>
  );
}
