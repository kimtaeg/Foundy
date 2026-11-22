import { DashboardSectionDivider } from "@/components/dashboard/DashboardSectionDivider";
import { Skeleton } from "@/components/loading/Skeleton";

function CardHeading() {
  return (
    <div className="mb-5 flex h-7 items-center justify-between gap-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function DashboardBentoSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="대시보드 현황을 불러오는 중" data-testid="dashboard-bento-skeleton"
      className="relative grid grid-cols-1 gap-8 max-sm:gap-12 md:grid-cols-2 lg:gap-12 xl:grid-cols-12">
      <div className="relative grid min-w-0 grid-cols-[132px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8 md:col-span-2 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 xl:col-span-12">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-28 sm:h-12" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
          <div className="relative left-1/2 grid h-20 w-full min-w-[784px] -translate-x-1/2 grid-cols-7">
            {Array.from({ length: 7 }, (_, day) => (
              <div key={day} className="flex flex-col items-center gap-4 border-0 border-l border-solid border-neutral-200 pt-2">
                <Skeleton className="h-5 w-12 rounded-full" />
                {day === 3 && <Skeleton className="h-4 w-14" />}
              </div>
            ))}
          </div>
        </div>
        <DashboardSectionDivider className="absolute inset-x-0 -bottom-4 translate-y-1/2 max-sm:-bottom-6 lg:-bottom-6" />
      </div>

      <div className="min-w-0 md:col-span-2 xl:col-span-7">
        <CardHeading />
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="relative mx-auto grid size-44 shrink-0 place-items-center sm:size-48">
            <div className="absolute inset-1 rounded-full border-[22px] border-solid border-neutral-200/70 motion-safe:animate-pulse" />
            <Skeleton className="h-8 w-16" />
          </div>
          <div className="min-w-40 flex-1 space-y-3">
            {[0, 1, 2, 3].map((group) => (
              <div key={group} className="space-y-1.5">
                <div className="flex items-center justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-8" /></div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative min-w-0 xl:col-span-5">
        <DashboardSectionDivider className="absolute inset-x-0 -top-4 -translate-y-1/2 max-sm:-top-6 lg:-top-6 lg:w-[calc(200%+3rem)] xl:hidden" />
        <CardHeading />
        <div className="space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mt-8 space-y-3 border-0 border-t border-solid border-neutral-200 pt-6 sm:mt-5 sm:pt-4">
          <Skeleton className="h-1.5 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>

      <DashboardSectionDivider className="absolute inset-x-0 -top-6 hidden -translate-y-1/2 xl:col-span-full xl:row-start-3 xl:block" />
      <div className="relative min-w-0 xl:col-span-7">
        <DashboardSectionDivider className="absolute inset-x-0 -top-4 -translate-y-1/2 max-sm:-top-6 lg:hidden" />
        <CardHeading />
        {[0, 1, 2].map((task) => (
          <div key={task} className="flex gap-3 border-0 border-b border-solid border-neutral-100 py-3">
            <Skeleton className="mt-1 size-4 shrink-0 rounded-sm" />
            <div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/5" /><Skeleton className="h-4 w-24" /></div>
          </div>
        ))}
      </div>

      <div className="relative min-w-0 md:col-span-2 xl:col-span-5">
        <DashboardSectionDivider className="absolute inset-x-0 -top-4 -translate-y-1/2 max-sm:-top-6 lg:-top-6 xl:hidden" />
        <CardHeading />
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-20" /></div>
          <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-20" /></div>
        </div>
        <div className="mt-5 grid h-32 grid-cols-24 items-end gap-[3px] border-0 border-b border-solid border-neutral-200">
          {Array.from({ length: 24 }, (_, hour) => (
            <Skeleton key={hour} className="h-3/4 w-full rounded-t-sm rounded-b-none" />
          ))}
        </div>
        <div className="mt-2 flex justify-between">
          {[0, 1, 2, 3, 4].map((tick) => <Skeleton key={tick} className="h-3 w-6" />)}
        </div>
        <Skeleton className="mt-4 h-3 w-2/3" />
      </div>
    </div>
  );
}
