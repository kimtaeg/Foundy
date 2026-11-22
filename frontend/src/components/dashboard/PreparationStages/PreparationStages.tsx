import { preparationStageColor } from "@/lib/dashboard/preparation-chart";
import type { DashboardStageProgress } from "@/types/dashboard";

export interface PreparationStagesProps {
  stages: DashboardStageProgress[];
  /** The entire checklist, shared by every stage's contribution. */
  total?: number;
}

export function PreparationStages({ stages, total = stages.reduce((sum, stage) => sum + stage.total, 0) }: PreparationStagesProps) {
  const overallTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  return (
    <div className="min-w-40 flex-1">
      <ul className="m-0 list-none space-y-3 p-0" aria-label="단계별 체크리스트 완료 현황">
        {stages.map((stage, index) => {
          const stageTotal = Number.isFinite(stage.total) ? Math.max(0, stage.total) : 0;
          const done = Number.isFinite(stage.done) ? Math.min(overallTotal, stageTotal, Math.max(0, stage.done)) : 0;
          const color = preparationStageColor(stage.label, index);
          return (
            <li key={stage.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-neutral-600"><span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />{stage.label}</span>
                <span className="shrink-0 font-medium tabular-nums text-neutral-800">{done}개</span>
              </div>
              <div role="progressbar" aria-label={stage.label} aria-valuemin={0} aria-valuemax={overallTotal || 1} aria-valuenow={done}
                aria-valuetext={`전체 ${overallTotal}개 중 ${stage.label} ${done}개 완료`} className="relative h-1.5 overflow-hidden rounded-full">
                <div aria-hidden="true" className="absolute inset-0 opacity-[0.16]" style={{ backgroundColor: color }} />
                <div className="relative h-full rounded-full" style={{ backgroundColor: color, width: `${overallTotal ? done / overallTotal * 100 : 0}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
