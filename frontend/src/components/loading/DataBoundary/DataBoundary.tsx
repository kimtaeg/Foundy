"use client";

import { Suspense, type ReactNode } from "react";
import { DataContent } from "@/components/loading/DataContent";
import { DataError } from "@/components/loading/DataError";
import { DataErrorBoundary } from "@/components/loading/DataErrorBoundary";
import type { DataState } from "@/types/data-state";

export interface DataBoundaryProps<T> extends DataState<T> {
  children: (data: T) => ReactNode;
  fallback: ReactNode;
}

/** Effect-based loaders use loading; Promise-based loaders suspend with React.use. */
export function DataBoundary<T>({ data, loading = false, error, onRetry, children, fallback }: DataBoundaryProps<T>) {
  if (loading) return fallback;
  if (error) return <DataError message={error} onRetry={onRetry} />;
  if (data === undefined) return fallback;
  return (
    <DataErrorBoundary resetKey={data} onRetry={onRetry}>
      <Suspense fallback={fallback}>
        <DataContent data={data}>{children}</DataContent>
      </Suspense>
    </DataErrorBoundary>
  );
}
