"use client";
import { ChecklistView } from "@/components/checklist/ChecklistView";
import { useChecklist } from "@/hooks/useChecklist";
import { useFoundy } from "@/hooks/useFoundy";

/** Connects the local demo store; API consumers can render ChecklistView directly. */
export function ChecklistPage() {
  const data = useChecklist();
  const { onEvent } = useFoundy();
  return <ChecklistView data={data ?? undefined} loading={data === null} onEvent={onEvent} />;
}
