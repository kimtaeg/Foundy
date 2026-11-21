"use client";
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({
  value,
  defaultValue,
  className,
  ...props
}: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const initialValue = value ?? defaultValue;
  useLayoutEffect(() => {
    if (
      ref.current &&
      initialValue != null &&
      ref.current.value !== String(initialValue)
    )
      ref.current.value = String(initialValue);
  }, [initialValue]);
  return (
    <textarea
      {...props}
      ref={ref}
      defaultValue={initialValue}
      className={
        className ??
        "min-h-24 w-full resize-y rounded-xl border border-transparent bg-neutral-50 px-4 py-3 text-base text-foundy-ink outline-none focus:border-foundy-primary focus:bg-white"
      }
    />
  );
}
