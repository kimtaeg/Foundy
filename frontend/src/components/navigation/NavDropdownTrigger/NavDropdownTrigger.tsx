import type { KeyboardEventHandler, Ref } from "react";
import { navigationItemClasses } from "@/lib/styles/navigation";

export interface NavDropdownTriggerProps {
  label: string;
  active: boolean;
  open: boolean;
  panelId: string;
  buttonRef: Ref<HTMLButtonElement>;
  onToggle: () => void;
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
}

export function NavDropdownTrigger({ label, active, open, panelId, buttonRef, onToggle, onKeyDown }: NavDropdownTriggerProps) {
  return (
    <button type="button" ref={buttonRef} aria-expanded={open} aria-controls={open ? panelId : undefined}
      data-navigation-group="preparation" data-active={active || undefined}
      onClick={onToggle} onKeyDown={onKeyDown} className={navigationItemClasses(active)}>
      {label}
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" className={`size-3 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
        <path d="m4 6 4 4 4-4" />
      </svg>
    </button>
  );
}
