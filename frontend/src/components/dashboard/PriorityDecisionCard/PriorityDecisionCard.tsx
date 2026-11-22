import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardCardLink } from "@/components/dashboard/DashboardCardLink";
import { DashboardSectionHeader } from "@/components/dashboard/DashboardSectionHeader";
import { PriorityDecisionContent } from "@/components/dashboard/PriorityDecisionContent";
import { ReportStatusStrip } from "@/components/dashboard/ReportStatusStrip";
import type { DashboardDecision } from "@/types/dashboard";
import type { Verdict } from "@/types/report";

export interface PriorityDecisionCardProps {
  cards: DashboardDecision[];
  undecided: boolean;
  counts?: Record<Verdict, number>;
  sourceLabel?: string;
  className?: string;
}

const priority: Record<Verdict, number> = { high: 0, unknown: 1, low: 2, ok: 3 };

export function PriorityDecisionCard({ cards, undecided, counts, sourceLabel, className = "" }: PriorityDecisionCardProps) {
  const first = [...cards].sort((a, b) => priority[a.base] - priority[b.base])[0];
  return (
    <DashboardCard className={className} label="먼저 결정할 일">
      <DashboardSectionHeader
        title="먼저 결정할 일"
        action={!undecided && <span className="text-sm font-medium tabular-nums text-neutral-600">{cards.length}건</span>}
      />
      <div className="flex flex-col items-start">
        {undecided ? (
          <>
            <p className="mb-0 mt-0 text-xl font-semibold leading-snug tracking-tight text-neutral-900">가게가 시작될 곳을<br />먼저 찾아볼까요?</p>
            <p className="mb-3 mt-3 text-sm leading-relaxed text-neutral-600">자리를 정하면 건물 용도와 상표 등 계약 전 확인할 사항을 살펴볼 수 있어요.</p>
            <DashboardCardLink page="sites">상권 둘러보기</DashboardCardLink>
          </>
        ) : first ? (
          <PriorityDecisionContent card={first} />
        ) : (
          <>
            <p className="m-0 text-xl font-semibold tracking-tight text-neutral-900">지금은 결정할 일이 없어요</p>
            <p className="mb-3 mt-3 text-sm leading-relaxed text-neutral-600">선택한 내용에 따라 이어서 할 일이 있는지 점검 리포트에서 확인해 보세요.</p>
            <DashboardCardLink page="report" className="px-0">점검 리포트 보기</DashboardCardLink>
          </>
        )}
      </div>
      {!undecided && counts && <ReportStatusStrip counts={counts} sourceLabel={sourceLabel} />}
    </DashboardCard>
  );
}
