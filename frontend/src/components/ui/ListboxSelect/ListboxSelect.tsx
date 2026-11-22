"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

export interface ListboxOption {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
}

export interface ListboxSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue" | "children" | "multiple" | "className"> {
  value: string | number;
  options: ListboxOption[];
  className?: string;
  listClassName?: string;
}

const gutter = 12;
const gap = 4;
const maxListHeight = 288;
const pageStep = 8;

const defaultButton =
  "inline-flex items-center justify-between gap-2 rounded-md border border-solid border-neutral-200 bg-white py-1.5 pl-2.5 pr-2 text-sm text-neutral-900 hover:border-neutral-300 aria-expanded:border-foundy-primary disabled:cursor-not-allowed disabled:opacity-50";

function labelText(option: ListboxOption) {
  return typeof option.label === "string" || typeof option.label === "number" ? String(option.label) : String(option.value);
}

/**
 * Button + listbox replacement for a native select.
 * The native picker cannot be relied on inside popovers and dialogs, so options render in the page,
 * while a hidden native select keeps form values and bubbling change events for existing handlers.
 */
export function ListboxSelect({
  value,
  options,
  className,
  listClassName,
  disabled,
  id,
  onChange,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...selectProps
}: ListboxSelectProps) {
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const selectedIndex = options.findIndex((option) => String(option.value) === String(value));
  const selected = options[selectedIndex];

  function enabledFrom(start: number, step: 1 | -1) {
    for (let index = start; index >= 0 && index < options.length; index += step) {
      if (!options[index].disabled) return index;
    }
    return -1;
  }

  function moveActive(target: number, step: 1 | -1) {
    const bounded = Math.max(0, Math.min(options.length - 1, target));
    const next = enabledFrom(bounded, step);
    const fallback = next === -1 ? enabledFrom(bounded, step === 1 ? -1 : 1) : next;
    if (fallback !== -1) setActive(fallback);
  }

  function close(focusTrigger: boolean) {
    if (list.current?.matches(":popover-open")) list.current.hidePopover();
    if (focusTrigger) trigger.current?.focus({ preventScroll: true });
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    close(true);
    const element = select.current;
    if (!element || String(option.value) === String(value)) return;
    // Let existing delegated and React change handlers observe a real select change.
    element.value = String(option.value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  useLayoutEffect(() => {
    const button = trigger.current;
    const listbox = list.current;
    if (!open || !button || !listbox) return;
    const viewport = window.visualViewport;

    const position = () => {
      if (!listbox.matches(":popover-open")) return;
      const anchor = button.getBoundingClientRect();
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? document.documentElement.clientWidth);
      const bottom = top + (viewport?.height ?? window.innerHeight);
      if (anchor.bottom <= top || anchor.top >= bottom) {
        listbox.hidePopover();
        return;
      }
      listbox.style.minWidth = anchor.width + "px";
      listbox.style.maxHeight = "";
      const height = Math.min(listbox.scrollHeight, maxListHeight);
      const below = bottom - gutter - anchor.bottom - gap;
      const above = anchor.top - gap - top - gutter;
      const placeAbove = height > below && above > below;
      const available = Math.max(0, Math.min(maxListHeight, placeAbove ? above : below));
      const width = listbox.offsetWidth;
      listbox.style.maxHeight = available + "px";
      listbox.style.top = (placeAbove ? anchor.top - gap - Math.min(height, available) : anchor.bottom + gap) + "px";
      listbox.style.left = Math.max(left + gutter, Math.min(anchor.left, right - gutter - width)) + "px";
    };

    position();
    listbox.focus({ preventScroll: true });
    listbox.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "center" });
    const reposition = (event: Event) => {
      if (event.target !== listbox) position();
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", position);
    viewport?.addEventListener("resize", position);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", position);
      viewport?.removeEventListener("resize", position);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open && active >= 0) list.current?.querySelector("#" + CSS.escape(optionId(active)))?.scrollIntoView({ block: "nearest" });
    // optionId is derived from the stable list id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const listbox = list.current;
      if (!listbox || listbox.matches(":popover-open")) return;
      setActive(selectedIndex >= 0 ? selectedIndex : enabledFrom(0, 1));
      listbox.showPopover();
      // Move focus now so keys typed right after opening reach the list.
      listbox.focus({ preventScroll: true });
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    switch (event.key) {
      case "ArrowDown":
        handled();
        moveActive(active + 1, 1);
        return;
      case "ArrowUp":
        handled();
        moveActive(active - 1, -1);
        return;
      case "PageDown":
        handled();
        moveActive(active + pageStep, 1);
        return;
      case "PageUp":
        handled();
        moveActive(active - pageStep, -1);
        return;
      case "Home":
        handled();
        moveActive(0, 1);
        return;
      case "End":
        handled();
        moveActive(options.length - 1, -1);
        return;
      case "Enter":
      case " ":
        handled();
        choose(active);
        return;
      case "Escape":
        handled();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      handled();
      const now = event.timeStamp;
      const state = typeahead.current;
      state.text = now - state.at > 600 ? event.key : state.text + event.key;
      state.at = now;
      const query = state.text.toLocaleLowerCase();
      const order = options.map((_, index) => (active + 1 + index) % options.length);
      const match = order.find((index) => !options[index].disabled && labelText(options[index]).toLocaleLowerCase().startsWith(query));
      if (match !== undefined) setActive(match);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        popoverTarget={listId}
        onKeyDown={onTriggerKeyDown}
        className={className ?? defaultButton}
      >
        <span className="min-w-0 truncate">{selected?.label}</span>
        <svg aria-hidden="true" className="size-4 shrink-0 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <select
        {...selectProps}
        ref={select}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        value={selected ? String(selected.value) : ""}
        onChange={onChange ?? (() => {})}
      >
        {!selected && <option value="" />}
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
            {labelText(option)}
          </option>
        ))}
      </select>
      <div
        ref={list}
        id={listId}
        popover="auto"
        role="listbox"
        tabIndex={-1}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : ariaLabelledBy}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        onToggle={(event) => {
          const isOpen = event.newState === "open";
          if (isOpen && document.activeElement !== event.currentTarget) setActive(selectedIndex >= 0 ? selectedIndex : enabledFrom(0, 1));
          setOpen(isOpen);
        }}
        onKeyDown={onListKeyDown}
        onBlur={(event) => {
          if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
            if (event.relatedTarget !== trigger.current) close(false);
          }
        }}
        className={
          listClassName ??
          "fixed inset-auto m-0 overflow-y-auto overscroll-contain rounded-lg border border-solid border-neutral-200 bg-white p-1 text-sm text-neutral-900 shadow-lg outline-none"
        }
      >
        {options.map((option, index) => (
          <div
            key={String(option.value)}
            id={optionId(index)}
            role="option"
            aria-selected={index === selectedIndex}
            aria-disabled={option.disabled || undefined}
            data-active={index === active || undefined}
            onPointerMove={() => {
              if (!option.disabled && index !== active) setActive(index);
            }}
            onClick={() => choose(index)}
            className="flex min-h-9 cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-md px-2.5 py-1.5 data-active:bg-neutral-100 aria-selected:font-semibold aria-selected:text-foundy-primary-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
          >
            <span>{option.label}</span>
            {index === selectedIndex && (
              <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5 9-10" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
