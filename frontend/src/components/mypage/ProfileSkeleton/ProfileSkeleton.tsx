import { Skeleton } from "@/components/loading/Skeleton";
import { profileColumns } from "../profile-styles";

function FieldRow() {
  return (
    <div className="flex items-center justify-between gap-3 border-0 border-b border-solid border-neutral-100 py-2.5">
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-2/3 max-w-48" />
      </div>
      <Skeleton className="mr-3 size-4" />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="마이페이지를 불러오는 중" data-skeleton="mypage" data-page-skeleton="mypage" className="pt-2 sm:pt-3">
      <div aria-hidden="true" className={profileColumns}>
        <div>
          <div className="mb-3 flex h-7 items-center gap-3"><Skeleton className="h-6 w-20" /><Skeleton className="h-5 w-14" /></div>
          {Array.from({ length: 6 }, (_, index) => <FieldRow key={index} />)}
        </div>
        <div className="border-0 border-t border-solid border-neutral-200 pt-7 lg:border-t-0 lg:pt-0">
          <Skeleton className="mb-3 h-7 w-24" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between border-0 border-b border-solid border-neutral-100 py-2.5">
              <Skeleton className="h-5 w-20" /><Skeleton className="h-11 w-28" />
            </div>
          ))}
          <FieldRow />
        </div>
      </div>
      <div aria-hidden="true" className={`${profileColumns} mt-8 border-0 border-t border-solid border-neutral-200 pt-7 lg:mt-10 lg:pt-8`}>
        <div><Skeleton className="mb-4 h-7 w-20" /><FieldRow /><Skeleton className="mt-3 h-4 w-44" /></div>
        <div className="border-0 border-t border-solid border-neutral-200 pt-7 lg:border-t-0 lg:pt-0">
          <Skeleton className="h-7 w-28" /><Skeleton className="mt-3 h-5 w-4/5" /><Skeleton className="mt-4 h-11 w-32" />
        </div>
      </div>
    </div>
  );
}
