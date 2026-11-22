"use client";
import { ApplicationFeedback } from "@/components/layout/ApplicationFeedback";
import { useFoundy } from "@/hooks/useFoundy";

export function ConnectedApplicationFeedback() {
  const { engine, snapshot, onEvent, closeModal } = useFoundy();
  if (!engine || !snapshot) return null;
  return (
    <ApplicationFeedback
      data={{ modal: snapshot.modal, toast: snapshot.toast, toastId: snapshot.toastId }}
      onCloseModal={closeModal}
      onEvent={onEvent}
    />
  );
}
