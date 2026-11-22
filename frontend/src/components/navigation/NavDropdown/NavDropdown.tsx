"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NavDropdownItem } from "@/components/navigation/NavDropdownItem";
import { NavDropdownTrigger } from "@/components/navigation/NavDropdownTrigger";
import type { NavigationDestination } from "@/types/navigation";

export interface NavDropdownProps {
  label: string;
  destinations: NavigationDestination[];
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function NavDropdown({ label, destinations, currentPage, onNavigate }: NavDropdownProps) {
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<"first" | "last" | null>(null);
  const [open, setOpen] = useState(false);
  const active = destinations.some((destination) => destination.id === currentPage);

  useEffect(() => { setOpen(false); }, [currentPage]);
  useEffect(() => {
    if (!open) return;
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button[data-page]");
    if (initialFocus.current && buttons?.length) {
      buttons[initialFocus.current === "last" ? buttons.length - 1 : 0].focus();
      initialFocus.current = null;
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
          return;
        }
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button[data-page]") ?? []);
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        const next = event.key === "ArrowDown" ? (index + 1) % buttons.length
          : event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length
          : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : null;
        if (next !== null) { event.preventDefault(); buttons[next].focus(); }
      }}>
      <NavDropdownTrigger label={label} active={active} open={open} panelId={panelId} buttonRef={trigger}
        onToggle={() => { initialFocus.current = null; setOpen((previous) => !previous); }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const last = event.key === "ArrowUp";
          if (open) {
            const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button[data-page]");
            if (buttons?.length) buttons[last ? buttons.length - 1 : 0].focus();
          } else {
            initialFocus.current = last ? "last" : "first";
            setOpen(true);
          }
        }} />
      {open && (
        <div ref={panel} id={panelId} role="group" aria-label={`${label} 메뉴`}
          className="absolute left-0 top-full z-50 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-solid border-neutral-200 bg-white opacity-100 shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-[opacity,translate] duration-[180ms] ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none sm:w-80">
          <ul className="m-0 list-none overflow-hidden rounded-[inherit] p-0">
            {destinations.map((destination) => (
              <li key={destination.id} className="border-0 border-b border-solid border-neutral-200 last:border-b-0">
                <NavDropdownItem destination={destination} active={destination.id === currentPage}
                  onNavigate={(page) => { setOpen(false); onNavigate(page); }} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
