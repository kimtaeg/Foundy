"use client";

import { DayPicker, type DayPickerProps, type DropdownProps } from "react-day-picker";
import { ko } from "react-day-picker/locale/ko";
import { ListboxSelect } from "@/components/ui/ListboxSelect";

export type CalendarProps = DayPickerProps;

const navButton =
  "inline-flex size-11 items-center justify-center rounded-lg border-0 bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 aria-disabled:opacity-30 focus-visible:outline-foundy-primary";

const dropdownButton =
  "inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 text-base font-semibold text-neutral-900 hover:bg-neutral-50 aria-expanded:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50";

// Adapted from Origin UI's DayPicker calendar; the monthly agenda supplies its own day cells.
const classes = {
  months: "relative flex flex-col gap-4",
  month: "min-w-0 w-full",
  month_caption:
    "relative z-10 mx-12 mb-1 flex h-11 items-center justify-center",
  caption_label:
    "inline-flex items-center gap-1 whitespace-nowrap text-base font-semibold text-neutral-900",
  nav: "absolute inset-x-0 top-0 flex justify-between",
  button_previous: navButton,
  button_next: navButton,
  chevron: "size-4 fill-current",
  dropdowns: "flex items-center justify-center gap-1",
  month_grid: "w-full table-fixed border-collapse",
  weekday: "h-8 p-0 text-center text-[13px] font-medium text-neutral-600",
  day: "group p-0.5 text-center",
  day_button:
    "relative mx-auto flex h-10 w-full max-w-11 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-[15px] font-medium text-neutral-800 tabular-nums hover:bg-neutral-100 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-foundy-primary group-data-selected:bg-foundy-primary group-data-selected:text-white group-data-outside:text-neutral-500 group-data-disabled:opacity-40 motion-safe:transition-colors",
  today:
    "[&_button]:after:absolute [&_button]:after:bottom-1 [&_button]:after:size-1 [&_button]:after:rounded-full [&_button]:after:bg-current",
  hidden: "invisible",
};

/** Year and month pickers use an in-page listbox; the native picker is unreliable inside popovers. */
function CalendarDropdown({ options = [], value, onChange, disabled, "aria-label": ariaLabel }: DropdownProps) {
  return (
    <ListboxSelect
      aria-label={ariaLabel}
      value={value === undefined ? "" : String(value)}
      options={options.map((option) => ({ value: option.value, label: option.label, disabled: option.disabled }))}
      onChange={onChange}
      disabled={disabled}
      className={dropdownButton}
    />
  );
}

export function Calendar({
  className,
  classNames,
  components,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={ko}
      showOutsideDays={showOutsideDays}
      className={className ?? "w-full"}
      classNames={{ ...classes, ...classNames }}
      components={{ Dropdown: CalendarDropdown, ...components }}
      {...props}
    />
  );
}
