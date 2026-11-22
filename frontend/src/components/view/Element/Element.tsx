"use client";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { resolveUiClasses } from "@/lib/styles/recipes";
import { createElement, type ComponentPropsWithoutRef, type JSX } from "react";

type Tag = keyof JSX.IntrinsicElements;
export type ElementProps<T extends Tag = "div"> = {
  as?: T;
} & ComponentPropsWithoutRef<T>;

/** Applies the shared visual vocabulary without owning feature state or behavior. */
export function Element<T extends Tag = "div">({
  as,
  className,
  ...props
}: ElementProps<T>) {
  const tag = as ?? "div";
  const attributes = { ...props, className: resolveUiClasses(tag, className) };
  if (tag === "input")
    return createElement(
      Input,
      attributes as ComponentPropsWithoutRef<"input">,
    );
  if (tag === "select")
    return createElement(
      Select,
      attributes as ComponentPropsWithoutRef<"select">,
    );
  if (tag === "textarea")
    return createElement(
      Textarea,
      attributes as ComponentPropsWithoutRef<"textarea">,
    );
  return createElement(tag, attributes);
}
