import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";

export function ApplicationLoading() {
  return (
    <div className="min-h-dvh bg-white" aria-busy="true">
      <SectionSkeleton variant="navigation" label="메뉴를 불러오는 중" />
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-7 lg:px-10">
        <PageSkeleton />
      </div>
    </div>
  );
}
