import { Skeleton } from "@/components/loading/Skeleton";

export function ReportSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="점검 리포트를 불러오는 중" data-skeleton="report" data-page-skeleton="report">
      <div aria-hidden="true">
        <div className="mb-5 space-y-4 border-0 border-b border-solid border-neutral-200 pb-7">
          <Skeleton className="h-5 w-28" /><Skeleton className="h-9 w-44" /><Skeleton className="h-5 w-full max-w-sm" />
        </div>
        <div className="grid gap-5 border-0 border-b border-solid border-neutral-200 pb-7 sm:grid-cols-[1fr_1.8fr] sm:items-end sm:gap-12">
          <div className="space-y-2"><Skeleton className="h-5 w-28" /><Skeleton className="h-12 w-16" /></div>
          <div className="space-y-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-2 w-full" /><Skeleton className="h-4 w-3/5" /></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 pt-6 sm:pt-8">
          <Skeleton className="h-7 w-28" /><Skeleton className="h-9 w-56 rounded-full" />
        </div>
        <div className="ml-1 space-y-7 border-0 border-l border-solid border-neutral-200 pl-5 sm:pl-7 lg:space-y-9">
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid items-start gap-3 lg:grid-cols-[8rem_minmax(0,1fr)] lg:gap-x-6">
              <Skeleton className="h-6 w-20" />
              <div className="grid gap-2 border-0 border-t border-solid border-neutral-200 py-4">
                <Skeleton className="h-5 w-28" /><Skeleton className="h-6 w-3/4 max-w-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
