import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardCardLink } from "@/components/dashboard/DashboardCardLink";
import { DashboardSectionHeader } from "@/components/dashboard/DashboardSectionHeader";
import { PreparationRing } from "@/components/dashboard/PreparationRing";
import { PreparationStages } from "@/components/dashboard/PreparationStages";
import type { DashboardStageProgress } from "@/types/dashboard";

export interface PreparationProgressCardProps {
  count: { done: number; total: number };
  stages?: DashboardStageProgress[];
  className?: string;
}

export function PreparationProgressCard({ count, stages, className = "" }: PreparationProgressCardProps) {
  const remaining = Math.max(0, count.total - count.done);
  return (
    <DashboardCard className={className} label="체크리스트 완료율">
      <DashboardSectionHeader
        title="체크리스트 완료율"
        action={<DashboardCardLink page="checklist" className="-my-2">전체 보기</DashboardCardLink>}
      />
      <div className="flex flex-wrap items-center justify-center gap-6">
        <PreparationRing done={count.done} total={count.total} stages={stages} />
        {stages?.length ? <PreparationStages stages={stages} total={count.total} /> : (
          <div className="min-w-0 flex-1 text-center min-[460px]:text-left">
            <p className="m-0 text-xl font-semibold text-neutral-900">{remaining ? "다음 한 가지부터" : count.total ? "준비한 만큼, 한 걸음 더" : "시작을 함께할게요"}</p>
            <p className="mb-0 mt-2 text-sm leading-relaxed text-neutral-600">체크리스트에서 할 일을 확인하고 완료한 항목을 체크해 주세요.</p>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
