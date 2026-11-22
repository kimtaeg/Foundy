import { Skeleton } from "@/components/loading/Skeleton";

export function ChecklistSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="체크리스트를 불러오는 중"
      data-skeleton="checklist" data-page-skeleton="checklist"
      className="min-w-0"
    >
      <span className="sr-only">체크리스트를 불러오는 중</span>
      <div aria-hidden="true">
        <div className="mb-5 border-0 border-b border-solid border-neutral-200 pb-6 sm:pb-7">
          <div className="mb-5 flex h-8 items-center"><Skeleton className="h-4 w-32" /></div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
            <Skeleton className="h-10 w-full max-w-56" />
            <Skeleton className="h-11 w-24 sm:w-40 lg:row-span-2 lg:self-end" />
            <Skeleton className="col-span-full mt-3 h-5 w-full max-w-72 lg:col-span-1" />
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-0 border-b border-solid border-neutral-200 pb-6 sm:gap-12 sm:pb-8">
          <div className="space-y-3 sm:max-w-md">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-28" />
            <Skeleton className="h-1.5 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-28 sm:w-36" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4 sm:py-6">
          <Skeleton className="h-13 w-52 rounded-xl sm:w-60" />
          <div className="flex gap-1.5">
            <Skeleton className="h-9 w-12 rounded-full" />
            <Skeleton className="h-9 w-16 rounded-full" />
            <Skeleton className="h-9 w-12 rounded-full" />
          </div>
        </div>
        <div className="space-y-10 sm:space-y-8 lg:space-y-12">
          {[0, 1, 2].map((group) => (
            <div
              key={group}
              className="grid min-w-0 gap-4 border-0 border-t border-solid border-neutral-200 pt-10 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-8 sm:pt-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 lg:pt-12"
            >
              <div className="space-y-3">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-6">
                {[0, 1].map((row) => (
                  <div key={row} className="flex gap-3">
                    <Skeleton className="mt-1 size-4 shrink-0" />
                    <div className="flex-1 space-y-4">
                      <Skeleton className="h-5 w-4/5" />
                      <Skeleton className="h-4 w-3/5" />
                    </div>
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
