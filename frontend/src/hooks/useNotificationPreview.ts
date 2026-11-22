"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const previewWidth = 400;

/** Owns only disclosure lifecycle and viewport anchoring, independent of app state. */
export function useNotificationPreview() {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 64, left: 16, width: previewWidth });
  const cancelClose = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(previewWidth, window.innerWidth - 32);
    setPosition({
      top: rect.bottom + 12,
      left: Math.max(
        16,
        Math.min(rect.right - width, window.innerWidth - width - 16),
      ),
      width,
    });
  }, []);
  const show = useCallback(() => {
    cancelClose();
    updatePosition();
    setOpen(true);
  }, [cancelClose, updatePosition]);
  const close = useCallback(() => {
    cancelClose();
    setOpen(false);
  }, [cancelClose]);
  const scheduleClose = useCallback(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    cancelClose();
    timer.current = setTimeout(() => setOpen(false), 160);
  }, [cancelClose]);
  useEffect(() => () => cancelClose(), [cancelClose]);
  useEffect(() => {
    if (!open) return;
    const contains = (target: EventTarget | null) =>
      target instanceof Node &&
      (triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target));
    const outside = (event: PointerEvent) => {
      if (!contains(event.target)) close();
    };
    const focusOutside = (event: FocusEvent) => {
      if (!contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focusOutside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focusOutside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, close, updatePosition]);
  return {
    id,
    triggerRef,
    panelRef,
    open,
    position,
    show,
    close,
    cancelClose,
    scheduleClose,
  };
}
