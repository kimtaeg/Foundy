import { GrantsHeader } from "@/components/grants/GrantsHeader";
import { Skeleton } from "@/components/loading/Skeleton";

export function GrantsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="지원사업을 불러오는 중" data-skeleton="grants" data-page-skeleton="grants">
      <div aria-hidden="true" className="mb-5"><Skeleton className="h-11 w-full" /></div>
      <GrantsHeader />
      <div aria-hidden="true">
        <div className="space-y-3 pb-7 sm:pb-8">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-2 py-2">
                <Skeleton className="h-4 w-24 max-w-full" /><Skeleton className="h-8 w-10" />
              </div>
            ))}
          </div>
          <Skeleton className="h-1.5 w-full" />
        </div>
        <div className="space-y-5 border-0 border-t border-solid border-neutral-200 pt-6 sm:pt-8">
          <Skeleton className="h-6 w-36" />
          <div className="flex flex-wrap justify-between gap-3">
            <Skeleton className="h-9 w-64 max-w-full" /><Skeleton className="h-9 w-28" />
          </div>
          <div className="grid gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3 xl:gap-x-8">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-3">
                <Skeleton className="aspect-[2/1] min-h-[164px] w-full rounded-[10px]" />
                <Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
