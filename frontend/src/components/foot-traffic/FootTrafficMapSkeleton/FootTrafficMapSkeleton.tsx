import { Skeleton } from "@/components/loading/Skeleton";

export interface FootTrafficMapSkeletonProps {
  /** Once the map UI has mounted, only the Kakao canvas and zoom controls are pending. */
  canvasOnly?: boolean;
}

export function FootTrafficMapSkeleton({ canvasOnly = false }: FootTrafficMapSkeletonProps) {
  return (
    <div role="status" aria-busy="true" aria-label={canvasOnly ? "상권 지도를 불러오는 중" : "상권 지도"} data-skeleton="map"
      className="absolute inset-0 overflow-hidden bg-neutral-100">
      <span className="sr-only">상권 지도를 불러오는 중</span>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(32deg,transparent_48%,white_48%,white_52%,transparent_52%),linear-gradient(105deg,transparent_48%,white_48%,white_52%,transparent_52%)] [background-size:120px_76px,80px_100px]" />
        <div className="absolute left-1/2 top-1/2 grid size-40 -translate-1/2 place-items-center rounded-full border border-dashed border-neutral-300 bg-neutral-200/25 sm:size-60">
          <Skeleton className="size-4 rounded-full" />
        </div>
        <div className="absolute bottom-3 left-1/2 flex h-11 w-[90px] -translate-x-1/2 items-center justify-evenly rounded-xl border border-solid border-neutral-200 bg-white">
          <Skeleton className="size-4" /><Skeleton className="size-4" />
        </div>
        {!canvasOnly && (
          <>
            <div className="absolute left-3 top-3 rounded-xl border border-solid border-neutral-200 bg-white px-4 py-3 lg:hidden">
              <Skeleton className="h-4 w-14" />
            </div>
            <div className="absolute left-4 top-4 hidden max-h-[calc(60%-2rem)] w-[300px] space-y-4 overflow-hidden rounded-2xl border border-solid border-neutral-200 bg-white p-5 lg:block">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-5/6" />
              <div className="grid grid-cols-3 gap-3 border-0 border-b border-solid border-neutral-200 py-3">
                {[0, 1, 2].map((tab) => <Skeleton key={tab} className="mx-auto h-4 w-12" />)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2, 3].map((option) => <Skeleton key={option} className="h-9 w-14 rounded-full" />)}
              </div>
              <div className="space-y-3 border-0 border-t border-solid border-neutral-200 pt-4">
                <Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-4/5" />
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="absolute bottom-14 left-3 max-h-[45%] w-[min(300px,calc(100%-1.5rem))] space-y-3 overflow-hidden rounded-2xl border border-solid border-neutral-200 bg-white p-4 lg:left-4 lg:max-h-[calc(40%-3.5rem)]">
              <div className="flex justify-between"><Skeleton className="h-5 w-28" /><Skeleton className="h-4 w-16" /></div>
              <Skeleton className="h-3 w-32" />
              <div className="grid grid-cols-5 gap-1">
                {[0, 1, 2, 3, 4].map((level) => <Skeleton key={level} className="h-2" />)}
              </div>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
