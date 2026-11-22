import { useLayoutEffect, useRef } from "react";

const gutter = 12;
const gap = 6;

/** Keep the top-layer calendar beside its field, including inside a scrolling dialog. */
export function useCalendarPosition(open: boolean) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const field = trigger.current;
    const calendar = panel.current;
    if (!open || !field || !calendar) return;
    const viewport = window.visualViewport;

    const position = () => {
      if (!calendar.matches(":popover-open")) return;
      const anchor = field.getBoundingClientRect();
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? document.documentElement.clientWidth);
      const bottom = top + (viewport?.height ?? window.innerHeight);
      if (anchor.bottom <= top || anchor.top >= bottom) {
        calendar.hidePopover();
        return;
      }

      const width = Math.min(352, Math.max(280, anchor.width), right - left - gutter * 2);
      calendar.style.width = width + "px";
      const height = calendar.scrollHeight + calendar.offsetHeight - calendar.clientHeight;
      const below = bottom - gutter - anchor.bottom - gap;
      const above = anchor.top - gap - top - gutter;
      const placeAbove = height > below && above > below;
      const available = Math.max(0, placeAbove ? above : below);
      const y = placeAbove ? anchor.top - gap - Math.min(height, available) : anchor.bottom + gap;
      calendar.style.maxHeight = available + "px";
      calendar.style.top = Math.max(top + gutter, y) + "px";
      calendar.style.left = Math.max(left + gutter, Math.min(anchor.left, right - gutter - width)) + "px";
    };

    position();
    const observer = new ResizeObserver(position);
    observer.observe(field);
    if (calendar.firstElementChild) observer.observe(calendar.firstElementChild);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    viewport?.addEventListener("scroll", position);
    viewport?.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
      viewport?.removeEventListener("scroll", position);
      viewport?.removeEventListener("resize", position);
    };
  }, [open]);
  return { trigger, panel };
}
