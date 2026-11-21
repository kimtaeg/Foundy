"use client";
import { ApplicationFeedback } from "@/components/layout/ApplicationFeedback";
import { useFoundy } from "@/hooks/useFoundy";

export function ConnectedApplicationFeedback() {
  const { engine, snapshot, onEvent } = useFoundy();
  if (!engine || !snapshot) return null;
  return (
    <ApplicationFeedback
      data={{ modal: snapshot.modal, toast: snapshot.toast }}
      onCloseModal={() => engine.closeModal()}
      onEvent={onEvent}
    />
  );
}
