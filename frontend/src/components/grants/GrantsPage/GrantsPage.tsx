"use client";
import { GrantsView } from "@/components/grants/GrantsView";
import { useGrants } from "@/hooks/useGrants";
import { useFoundy } from "@/hooks/useFoundy";

/** Connects the local demo store; the view also accepts API data independently. */
export function GrantsPage() {
  const data = useGrants();
  const { onEvent } = useFoundy();
  return <GrantsView data={data ?? undefined} loading={data === null} onEvent={onEvent} />;
}
