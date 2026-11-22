"use client";

import { useId, useRef, useState } from "react";
import { Calendar } from "@/components/ui/Calendar";
import { D, iso } from "@/lib/date";
import { useCalendarPosition } from "./useCalendarPosition";

export interface DatePickerFieldProps {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  name?: string;
  onValueChange?: (value: string) => void;
}

export function DatePickerField({
  id,
  label,
  value,
  required,
  onValueChange,
  ...attributes
}: DatePickerFieldProps) {
  const panelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const { trigger, panel } = useCalendarPosition(open);
  const [draft, setDraft] = useState({ initial: value, current: value });
  if (draft.initial !== value) setDraft({ initial: value, current: value });

  const parsed = D(draft.current);
  const selected =
    Number.isFinite(parsed.getTime()) && iso(parsed) === draft.current
      ? parsed
      : undefined;
  const year = selected?.getFullYear() ?? new Date().getFullYear();
  const dateText = selected ? draft.current : "0000-00-00";

  function closeCalendar() {
    panel.current?.hidePopover();
    trigger.current?.focus({ preventScroll: true });
  }

  function selectDate(date: Date) {
    const next = iso(date);
    setDraft({ initial: value, current: next });
    if (input.current) {
      // Keep the native form value in sync with the calendar selection.
      input.current.value = next;
      input.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    onValueChange?.(next);
    closeCalendar();
  }

  return (
    <div
      className="min-w-0"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          panel.current?.hidePopover();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && panel.current?.matches(":popover-open")) {
          event.preventDefault();
          event.stopPropagation();
          closeCalendar();
        }
      }}
    >
      <input
        {...attributes}
        ref={input}
        id={id}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        required={required}
        value={selected ? draft.current : ""}
        onChange={(event) =>
          setDraft({ initial: value, current: event.target.value })
        }
        onInvalid={(event) => {
          event.preventDefault();
          trigger.current?.focus();
          panel.current?.showPopover();
        }}
      />
      <button
        ref={trigger}
        id={id + "-trigger"}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={label + ", " + (selected ? dateText : "날짜 선택")}
        popoverTarget={panelId}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-solid border-neutral-300 bg-white px-3.5 py-2 text-left text-base font-medium tabular-nums transition-colors hover:border-foundy-primary focus-visible:outline-foundy-primary aria-expanded:border-foundy-primary"
      >
        <span className={selected ? "text-neutral-900" : "text-neutral-500"}>{dateText}</span>
        <svg
          aria-hidden="true"
          className="shrink-0 text-neutral-600"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M7 3v4m10-4v4M3 10h18" />
        </svg>
      </button>
      <div
        ref={panel}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label={label + " 날짜 선택"}
        onToggle={(event) => setOpen(event.newState === "open")}
        className={`fixed inset-auto m-0 overflow-y-auto overscroll-contain rounded-xl border border-solid border-neutral-200 bg-white p-2 text-neutral-900 shadow-lg sm:p-3 ${open ? "" : "invisible"}`}
      >
        {open && (
          <Calendar
            mode="single"
            required
            selected={selected}
            defaultMonth={selected}
            autoFocus
            captionLayout="dropdown"
            startMonth={new Date(Math.min(1900, year), 0)}
            endMonth={new Date(Math.max(2150, year), 11)}
            onSelect={selectDate}
          />
        )}
      </div>
    </div>
  );
}
