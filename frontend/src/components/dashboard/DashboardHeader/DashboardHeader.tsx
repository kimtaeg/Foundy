"use client";

import { useMemo } from "react";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { DashboardHeaderActions } from "@/components/dashboard/DashboardHeaderActions";
import { DashboardHeaderDetails } from "@/components/dashboard/DashboardHeaderDetails";
import { buildStoreGreeting } from "@/lib/store-greeting";
import type { DashboardStore } from "@/types/dashboard";

export interface DashboardHeaderProps {
  store: DashboardStore;
  name: string;
  days: number;
  undecided: boolean;
}

export function DashboardHeader({ store, name, days, undecided }: DashboardHeaderProps) {
  const copy = useMemo(() => buildStoreGreeting(name, days), [name, days]);
  return (
    <header data-testid="dashboard-header" data-page-header="DASHBOARD" className="mb-8 border-0 border-b border-solid border-neutral-200 pb-9 sm:mb-6 sm:pb-7">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-8">
        <div className="min-w-0 space-y-4">
          <DashboardGreeting copy={copy} />
          <DashboardHeaderDetails store={store} undecided={undecided} dateLabel={copy.dateLabel} />
        </div>
        <DashboardHeaderActions undecided={undecided} />
      </div>
    </header>
  );
}
