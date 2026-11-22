import { DashboardBentoSkeleton } from "@/components/dashboard/DashboardBentoSkeleton";
import { DashboardHeaderSkeleton } from "@/components/dashboard/DashboardHeaderSkeleton";

export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="대시보드를 불러오는 중" data-page-skeleton="dashboard" data-skeleton="dashboard">
      <span className="sr-only">대시보드를 불러오는 중</span>
      <div aria-hidden="true">
        <DashboardHeaderSkeleton />
        <DashboardBentoSkeleton />
      </div>
    </div>
  );
}
