export interface DashboardSectionDividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function DashboardSectionDivider({ orientation = "horizontal", className = "" }: DashboardSectionDividerProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none shrink-0 bg-neutral-200 ${orientation === "vertical" ? "w-px" : "h-px w-full"} ${className}`}
    />
  );
}
