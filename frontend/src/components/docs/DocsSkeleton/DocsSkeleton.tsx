import { Skeleton } from "@/components/loading/Skeleton";

export function DocsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="서류함을 불러오는 중" data-skeleton="docs" data-page-skeleton="docs">
      <div aria-hidden="true">
        <div className="grid gap-5 border-0 border-b border-solid border-neutral-200 pb-7 sm:grid-cols-[1fr_1.4fr] sm:items-end sm:gap-12 sm:pb-8">
          <div className="space-y-2"><Skeleton className="h-6 w-32" /><Skeleton className="h-12 w-20" /></div>
          <div className="space-y-3"><Skeleton className="h-5 w-44" /><Skeleton className="h-2 w-full" /></div>
        </div>
        <div className="flex items-center justify-between gap-3 pb-4 pt-7 sm:gap-6 sm:pb-5 sm:pt-8">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-7 w-36 max-w-full" />
            <Skeleton className="h-5 w-full max-w-md" />
          </div>
          <Skeleton className="h-9 w-40 shrink-0 rounded-full" />
        </div>
        {[0, 1, 2].map((key) => (
          <div key={key} className="flex flex-col gap-6 border-0 border-t border-solid border-neutral-200 pb-1 pt-4 sm:pb-2 sm:pt-5">
            <div className="space-y-1.5"><Skeleton className="h-6 w-14 rounded-full" /><Skeleton className="h-6 w-3/4 max-w-xs" /><Skeleton className="h-5 w-48" /></div>
            <div className="flex min-h-11 items-center gap-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="size-4" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
