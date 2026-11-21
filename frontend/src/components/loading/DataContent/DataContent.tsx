"use client";

import { use, type ReactNode } from "react";
import type { AsyncData } from "@/types/data-state";

export interface DataContentProps<T> {
  data: AsyncData<T>;
  children: (data: T) => ReactNode;
}

export function DataContent<T>({ data, children }: DataContentProps<T>) {
  const isPromise = data !== null && typeof data === "object" && "then" in data && typeof data.then === "function";
  const resolved = isPromise ? use(data as Promise<T>) : data as T;
  return children(resolved);
}
