"use client";
import { useState } from "react";
import { Modal } from "@/components/feedback/Modal";
import { GrantDetails } from "@/components/grants/GrantDetails";
import { GrantsView } from "@/components/grants/GrantsView";
import { useGrants } from "@/hooks/useGrants";
import { grantDisplay } from "@/lib/grants/format-grant";
import type { ViewEventHandler } from "@/types/events";

export function GrantsPage() {
  const { onEvent, apiActive, ...state } = useGrants();
  const [detailId, setDetailId] = useState<string | null>(null);
  const item = apiActive && state.data?.grants.find(({ grant }) => grant.id === detailId);

  const handleEvent: ViewEventHandler = (type, event) => {
    if (apiActive && type === "click" && event.target instanceof Element) {
      const button = event.target.closest<HTMLButtonElement>('button[data-nx="gdetail"]');
      if (button) {
        setDetailId(button.dataset.id ?? null);
        return;
      }
    }
    onEvent(type, event);
  };

  return (
    <>
      <GrantsView {...state} onEvent={handleEvent} />
      {item && (
        <Modal variant="grant" title={grantDisplay(item.grant).title} onClose={() => setDetailId(null)}>
          <GrantDetails grant={item.grant} deadline={item.deadline} result={item} />
        </Modal>
      )}
    </>
  );
}
