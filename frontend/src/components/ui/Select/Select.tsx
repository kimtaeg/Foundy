"use client";
import { useLayoutEffect, useRef, type SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({
  value,
  defaultValue,
  className,
  ...props
}: SelectProps) {
  const ref = useRef<HTMLSelectElement>(null);
  const initialValue = value ?? defaultValue;
  // Equivalent option arrays should not reset an in-progress selection on every render.
  const selection =
    initialValue == null ? undefined : JSON.stringify(initialValue);
  useLayoutEffect(() => {
    if (!ref.current || selection == null) return;
    const selected: string | number | string[] = JSON.parse(selection);
    if (Array.isArray(selected)) {
      for (const option of ref.current.options)
        option.selected = selected.includes(option.value);
    } else ref.current.value = String(selected);
  }, [selection]);
  return (
    <select
      {...props}
      ref={ref}
      defaultValue={initialValue}
      className={
        className ??
        "min-h-12 w-full rounded-xl border border-transparent bg-neutral-50 px-4 py-3 text-base text-foundy-ink outline-none focus:border-foundy-primary focus:bg-white"
      }
    />
  );
}
