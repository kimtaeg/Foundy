import { Skeleton } from "@/components/loading/Skeleton";

export function NavbarSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="메뉴를 불러오는 중" data-skeleton="navigation"
      className="border-0 border-b border-solid border-neutral-200 bg-neutral-50">
      <span className="sr-only">메뉴를 불러오는 중</span>
      <div aria-hidden="true" className="mx-auto grid max-w-[1480px] grid-cols-[auto_1fr] items-center gap-x-3 px-4 py-4 sm:px-7 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-x-7 xl:px-9">
        <Skeleton className="h-6 w-20 sm:w-24" />
        <div className="col-span-2 col-start-1 row-start-2 -mb-2 mt-3 flex h-[61px] items-center gap-4 border-0 border-t border-solid border-neutral-200/70 pb-1 pt-3 xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:m-0 xl:h-11 xl:justify-center xl:gap-8 xl:border-0 xl:p-0">
          {["w-6", "w-16", "w-16", "w-14"].map((width, index) => <Skeleton key={index} className={`h-4 ${width}`} />)}
        </div>
        <div className="col-start-2 row-start-1 flex h-11 items-center justify-end gap-3 xl:col-start-3">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}
