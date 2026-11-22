import type { DashboardStore } from "@/types/dashboard";

export interface DashboardHeaderDetailsProps { store: DashboardStore; undecided: boolean; dateLabel: string }

export function DashboardHeaderDetails({ store, undecided, dateLabel }: DashboardHeaderDetailsProps) {
  const address = undecided
    ? [store.region, "후보 상권 비교 중"].filter(Boolean).join(" · ")
    : [store.address, store.detail].filter(Boolean).join(" ");
  return (
    <p className="m-0 break-words text-sm leading-relaxed text-neutral-600">
      {address}
      {store.opening && <>{address ? " · " : ""}{dateLabel} {store.opening}</>}
    </p>
  );
}
