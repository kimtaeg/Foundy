import { Skeleton } from "@/components/loading/Skeleton";
import type { SkeletonVariant } from "@/types/data-state";

export interface SectionSkeletonProps {
  variant?: SkeletonVariant;
  rows?: number;
  label?: string;
  className?: string;
  appearance?: "card" | "plain";
}

/** The section keeps its approximate layout while its data is unavailable. */
export function SectionSkeleton({
  variant = "card",
  rows = 3,
  label = "내용을 불러오는 중",
  className = "",
  appearance = "card",
}: SectionSkeletonProps) {
  const items = Array.from({ length: rows }, (_, index) => index);
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      data-skeleton={variant}
      className={`min-w-0 overflow-hidden ${appearance === "card" ? "rounded-2xl bg-neutral-50 p-5" : ""} ${variant === "map" ? "relative h-full min-h-64" : ""} ${className}`}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-5">
        {variant === "navigation" ? (
          <div className="flex items-center justify-between gap-6">
            <Skeleton className="h-7 w-24" />
            <div className="hidden flex-1 justify-center gap-4 md:flex">
              {items.map((item) => <Skeleton key={item} className="h-5 w-20" />)}
            </div>
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        ) : variant === "map" ? (
          <>
            <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(#e5e5e5_1px,transparent_1px),linear-gradient(90deg,#e5e5e5_1px,transparent_1px)] [background-size:48px_48px]" />
            <div className="relative w-full max-w-64 space-y-4 rounded-2xl bg-white p-5">
              <Skeleton className="h-6 w-32" />
              {items.map((item) => <Skeleton key={item} className="h-9 w-full" />)}
            </div>
            <Skeleton className="absolute bottom-6 left-6 h-16 w-52 bg-white" />
          </>
        ) : (
          <>
            <Skeleton className="h-5 w-2/5 max-w-48" />
            {variant === "chart" ? (
              <>
                <Skeleton className="h-8 w-1/3" />
                <div className="flex h-36 items-end gap-3 border-0 border-b border-solid border-neutral-200 pb-2">
                  {["h-1/3", "h-3/5", "h-4/5", "h-1/2", "h-full", "h-3/5"].map((height, index) => (
                    <Skeleton key={index} className={`flex-1 rounded-b-none ${height}`} />
                  ))}
                </div>
              </>
            ) : variant === "chat" ? (
              <>
                <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
                <div className="space-y-3">
                  {items.map((item) => <Skeleton key={item} className={`h-4 ${item === rows - 1 ? "w-2/3" : "w-full"}`} />)}
                </div>
              </>
            ) : variant === "form" ? (
              items.map((item) => (
                <div key={item} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              ))
            ) : variant === "list" || variant === "table" ? (
              items.map((item) => (
                <div key={item} className="flex items-center gap-3 border-0 border-b border-solid border-neutral-200/60 pb-4">
                  <Skeleton className="size-9 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-12" />
                </div>
              ))
            ) : (
              <>
                {variant === "card" && <Skeleton className="h-9 w-1/3" />}
                {items.map((item) => <Skeleton key={item} className={`h-4 ${item === rows - 1 ? "w-2/3" : "w-full"}`} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
