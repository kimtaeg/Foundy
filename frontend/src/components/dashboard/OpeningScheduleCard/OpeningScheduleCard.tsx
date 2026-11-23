import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSectionDivider } from "@/components/dashboard/DashboardSectionDivider";
import { OpeningWeekCalendar } from "@/components/dashboard/OpeningWeekCalendar";
import { buildOpeningWeek } from "@/lib/dashboard/opening-week";
import type { DashboardTask } from "@/types/dashboard";

export interface OpeningScheduleCardProps {
  opening: string;
  days: number;
  asOf?: string;
  tasks?: DashboardTask[];
  className?: string;
}

export function OpeningScheduleCard({ opening, days, asOf, tasks = [], className = "" }: OpeningScheduleCardProps) {
  const hasDate = buildOpeningWeek(opening).length > 0;
  const hasCountdown = hasDate && Number.isFinite(days);
  const past = hasCountdown && days < 0;
  const label = hasCountdown ? days === 0 ? "D-DAY" : `D${past ? "+" : "−"}${Math.abs(days)}` : "미정";
  return (
    <DashboardCard className={`relative ${className}`} label="개업 일정">
      <div className="grid min-w-0 grid-cols-[132px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <div>
          <header>
            <h2 className="m-0 text-sm font-medium text-neutral-600">{past ? "개업한 지" : "개업일까지"}</h2>
            <p className="mb-1 mt-2 text-4xl font-semibold leading-none tabular-nums tracking-tight text-neutral-900 sm:text-5xl">{label}</p>
            <p className="m-0 text-sm leading-relaxed text-neutral-600">{hasDate ? <time dateTime={opening}>{opening.replaceAll("-", ".")}</time> : "개업 예정일을 정해 주세요"}</p>
          </header>
        </div>
        <OpeningWeekCalendar opening={opening} asOf={asOf} tasks={tasks} />
      </div>
      <DashboardSectionDivider className="absolute inset-x-0 -bottom-4 translate-y-1/2 max-sm:-bottom-6 lg:-bottom-6" />
    </DashboardCard>
  );
}
