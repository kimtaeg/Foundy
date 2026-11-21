"use client";
import { DocsView } from "@/components/docs/DocsView";
import { useDocs } from "@/hooks/useDocs";
import { useFoundy } from "@/hooks/useFoundy";

/** Connects the local demo store; the view also accepts API data independently. */
export function DocsPage() {
  const data = useDocs();
  const { onEvent } = useFoundy();
  return <DocsView data={data ?? undefined} loading={data === null} onEvent={onEvent} />;
}
