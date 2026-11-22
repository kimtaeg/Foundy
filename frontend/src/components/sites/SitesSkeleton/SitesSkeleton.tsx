import { FootTrafficMapSkeleton } from "@/components/foot-traffic/FootTrafficMapSkeleton";
import { Skeleton } from "@/components/loading/Skeleton";

export function SitesSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="상권 분석을 불러오는 중" data-page-skeleton="sites" data-skeleton="sites"
      className="relative h-full w-full overflow-hidden bg-neutral-100">
      <span className="sr-only">상권 분석을 불러오는 중</span>
      <div aria-hidden="true" className="relative h-dvh max-h-full">
        <FootTrafficMapSkeleton />
        <div className="absolute right-3 top-3 rounded-xl border border-solid border-neutral-200 bg-white px-4 py-3 lg:hidden">
          <Skeleton className="h-4 w-14" />
        </div>
        <div className="absolute bottom-20 right-4 top-4 hidden w-[400px] overflow-hidden rounded-2xl border border-solid border-neutral-200 bg-white p-5 shadow-[0_8px_28px_rgb(0_0_0/0.09)] lg:block">
          <div className="flex items-center gap-2.5"><Skeleton className="h-7 w-20" /><Skeleton className="h-6 w-16 rounded-full" /></div>
          <Skeleton className="mt-2 h-4 w-3/5" />
          <div className="mt-3 grid h-11 grid-cols-4 items-center gap-4 border-0 border-b border-solid border-neutral-200">
            {[0, 1, 2, 3].map((tab) => <Skeleton key={tab} className="mx-auto h-4 w-12" />)}
          </div>
          <div className="my-5 flex gap-1.5">
            {[0, 1, 2].map((category) => <Skeleton key={category} className="h-9 w-14 rounded-full" />)}
          </div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-4 h-4 w-28" />
          <Skeleton className="mt-1 h-11 w-24" />
          <div className="mt-5 grid grid-cols-2 gap-4">
            {[0, 1].map((stat) => (
              <div key={stat} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-16" /></div>
            ))}
          </div>
          <Skeleton className="mt-4 h-3 w-36" />
          <div className="mt-6 space-y-3 border-0 border-t border-solid border-neutral-200 pt-6">
            <Skeleton className="h-6 w-36" /><Skeleton className="h-4 w-4/5" />
            <div className="grid grid-cols-2 gap-4 py-3"><Skeleton className="h-9 w-20" /><Skeleton className="h-9 w-20" /></div>
            <div className="size-28 rounded-full border-[18px] border-solid border-neutral-200/70 motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
