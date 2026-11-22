"use client";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { useDashboard } from "@/hooks/useDashboard";
import { useFoundy } from "@/hooks/useFoundy";
import { dashboardPopulationSnapshot } from "@/data/dashboard-population";

/** Connects the local demo store; API consumers can render DashboardView directly. */
export function DashboardPage() {
  const data = useDashboard();
  const { onEvent } = useFoundy();
  return <DashboardView data={data ?? undefined} loading={data === null} onEvent={onEvent} population={{ data: dashboardPopulationSnapshot }} />;
}
