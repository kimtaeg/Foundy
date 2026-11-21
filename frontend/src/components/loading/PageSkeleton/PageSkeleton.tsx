import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { Skeleton } from "@/components/loading/Skeleton";

export interface PageSkeletonProps {
  page?: string;
}

export function PageSkeleton({ page = "dashboard" }: PageSkeletonProps) {
  if (page === "sites")
    return <SectionSkeleton variant="map" label="상권 분석을 불러오는 중" className="h-full min-h-[70dvh] rounded-none" />;
  if (page === "chat")
    return <SectionSkeleton variant="chat" label="상담 내용을 불러오는 중" rows={4} />;
  const form = page === "register" || page === "mypage" || page === "login";
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-7" data-page-skeleton={page}>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-3/5 max-w-96" />
      </div>
      {!form && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((key) => <SectionSkeleton key={key} rows={1} label="요약 정보를 불러오는 중" />)}
        </div>
      )}
      <div className={form ? "space-y-4" : "grid grid-cols-1 gap-4 lg:grid-cols-2"}>
        <SectionSkeleton variant={form ? "form" : "list"} label="상세 내용을 불러오는 중" rows={form ? 3 : 4} />
        <SectionSkeleton variant={form ? "form" : page === "grants" ? "card" : "list"} label="관련 내용을 불러오는 중" rows={3} />
      </div>
    </div>
  );
}
