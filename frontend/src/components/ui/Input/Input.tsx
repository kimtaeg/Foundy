"use client";
import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";

/** Retain cursor and draft values while reflecting external value/check changes. */
export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({
  value,
  checked,
  defaultValue,
  defaultChecked,
  className,
  type = "text",
  ...props
}: InputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const initialValue = value ?? defaultValue;
  const initialChecked = checked ?? defaultChecked;
  useLayoutEffect(() => {
    if (
      ref.current &&
      initialValue != null &&
      ref.current.value !== String(initialValue)
    )
      ref.current.value = String(initialValue);
  }, [initialValue]);
  useLayoutEffect(() => {
    if (ref.current && initialChecked != null)
      ref.current.checked = initialChecked;
  }, [initialChecked]);
  const fallback =
    type === "checkbox" || type === "radio"
      ? "size-4 cursor-pointer accent-foundy-primary"
      : "min-h-12 w-full rounded-xl border border-transparent bg-neutral-50 px-4 py-3 text-base text-foundy-ink outline-none focus:border-foundy-primary focus:bg-white";
  return (
    <input
      {...props}
      ref={ref}
      type={type}
      className={className ?? fallback}
      defaultValue={initialValue}
      defaultChecked={initialChecked}
    />
  );
}
