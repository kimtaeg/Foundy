"use client";

import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { dialogSecondaryAction } from "./dialog-styles";
import type { DialogContent } from "@/types/dialog";

export interface ModalProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose(): void;
  variant?: "default" | DialogContent["kind"];
  getReturnFocusTarget?: () => HTMLElement | null;
}

function isBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const { top, right, bottom, left } = event.currentTarget.getBoundingClientRect();
  return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
}

function keepTabInDialog(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.defaultPrevented) return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'a[href], button, input, select, textarea, [tabindex], summary',
  )).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && (document.activeElement === first || document.activeElement?.id === "modalTitle")) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

export function Modal({ title, children, actions, onClose, variant = "default", getReturnFocusTarget }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const initialReturnTarget = useRef(getReturnFocusTarget);
  const navigated = useRef(false);
  const startedOnBackdrop = useRef(false);
  const isReportStep = variant === "option-choices" || variant === "option-confirm" || variant === "option-result";
  const isDetail = isReportStep || variant === "evidence" || variant === "grant";
  const contentHasTitle = isReportStep || variant === "grant";
  const showDismiss = variant === "default" || variant === "evidence" || variant === "grant";

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const triggerId = trigger?.id;
    const page = document.documentElement;
    const overflow = page.style.overflow;
    const resolveTarget = initialReturnTarget.current;
    dialog.showModal();
    titleRef.current?.focus({ preventScroll: true });
    page.style.overflow = "hidden";
    return () => {
      dialog.close();
      page.style.overflow = overflow;
      if (resolveTarget) {
        // Undo can replace the opener in the same React commit that closes the dialog.
        queueMicrotask(() => {
          if (!navigated.current && !document.querySelector("dialog[open]")) {
            const opener = trigger instanceof HTMLButtonElement && trigger.id === triggerId && trigger.isConnected
              && !trigger.closest("dialog, details:not([open])") ? trigger : resolveTarget();
            opener?.focus({ preventScroll: true });
          }
        });
      } else if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (getReturnFocusTarget && dialogRef.current?.open && !dialogRef.current.contains(document.activeElement)) {
      titleRef.current?.focus({ preventScroll: true });
    }
  });

  return (
    <dialog
      ref={dialogRef}
      id="modal"
      aria-modal="true"
      aria-labelledby="modalTitle"
      className={`show fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border border-solid border-neutral-200 bg-white p-0 text-neutral-900 shadow-[0_12px_44px_rgba(0,0,0,0.14)] open:flex backdrop:bg-neutral-900/40 ${isDetail ? "max-w-[580px]" : "max-w-[440px]"}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => { startedOnBackdrop.current = isBackdrop(event); }}
      onClickCapture={(event) => {
        if (variant === "option-result" && event.target instanceof Element) {
          navigated.current = Boolean(event.target.closest('[data-nx="go"], [data-nx="cnav"]'));
        }
      }}
      onClick={(event) => {
        const dismiss = event.target instanceof Element && event.target.closest("[data-dialog-dismiss]");
        if (dismiss || (startedOnBackdrop.current && isBackdrop(event))) onClose();
        startedOnBackdrop.current = false;
      }}
      onKeyDown={keepTabInDialog}
    >
      <div
        id="modalBody"
        className="relative grid min-h-0 min-w-0 auto-rows-max content-start gap-5 overflow-y-auto overscroll-contain p-5 sm:gap-6 sm:p-6"
      >
        <h2 id="modalTitle" ref={titleRef} tabIndex={-1}
          className={contentHasTitle ? "sr-only" : "m-0 min-w-0 break-keep text-lg font-semibold leading-snug tracking-tight outline-none [overflow-wrap:anywhere] sm:text-xl"}>
          {title}
        </h2>
        {children}
        {actions}
        {showDismiss && (
          <button id="closeModal" type="button" onClick={onClose} className={`justify-self-end ${dialogSecondaryAction}`}>닫기</button>
        )}
        {isReportStep && (
          <button type="button" onClick={onClose}
            className={`sr-only focus-visible:not-sr-only focus-visible:justify-self-end ${dialogSecondaryAction}`}>창 닫기</button>
        )}
      </div>
    </dialog>
  );
}
