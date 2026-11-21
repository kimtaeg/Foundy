export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-lg bg-neutral-200/70 motion-safe:animate-pulse ${className}`}
    />
  );
}
