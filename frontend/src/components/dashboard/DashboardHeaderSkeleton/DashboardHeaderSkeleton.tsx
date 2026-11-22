import { Skeleton } from "@/components/loading/Skeleton";

export function DashboardHeaderSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="대시보드 헤더를 불러오는 중" className="mb-8 border-0 border-b border-solid border-neutral-200 pb-9 sm:mb-6 sm:pb-7">
      <div aria-hidden="true" className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-8">
        <div className="min-w-0">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="mt-3 h-9 w-5/6 max-w-lg sm:h-11" />
          <Skeleton className="mt-4 h-5 w-3/5 max-w-80" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-40" />
        </div>
      </div>
    </div>
  );
}
