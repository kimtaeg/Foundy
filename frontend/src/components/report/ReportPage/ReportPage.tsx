"use client";
import { ReportView } from "@/components/report/ReportView";
import { useReport } from "@/hooks/useReport";
import { useFoundy } from "@/hooks/useFoundy";

/** Connects the local demo store; API consumers can render ReportView directly. */
export function ReportPage() {
  const data = useReport();
  const { onEvent } = useFoundy();
  return <ReportView data={data ?? undefined} loading={data === null} onEvent={onEvent} />;
}
