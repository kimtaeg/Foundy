"use client";

import { useEffect, useState } from "react";

interface ResourceResult<T> {
  load: () => Promise<T>;
  key: string;
  value?: T;
  error?: unknown;
}

/** Keeps effects mounted and never exposes a result belonging to old query props. */
export function useMapResource<T>(load: (() => Promise<T>) | undefined, key: string) {
  const [result, setResult] = useState<ResourceResult<T> | null>(null);
  useEffect(() => {
    if (!load) return;
    let current = true;
    Promise.resolve().then(load).then(
      (value) => { if (current) setResult({ load, key, value }); },
      (error: unknown) => { if (current) setResult({ load, key, error: error instanceof Error ? error : new Error("데이터를 불러오지 못했어요.") }); },
    );
    return () => { current = false; };
  }, [load, key]);
  const current = result?.load === load && result?.key === key ? result : null;
  return {
    value: current?.value,
    error: current?.error,
    loading: Boolean(load && !current),
  };
}
