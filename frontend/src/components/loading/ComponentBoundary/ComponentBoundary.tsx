"use client";

import type { ComponentType, ReactNode } from "react";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { DataState } from "@/types/data-state";

export interface ComponentBoundaryProps<Props extends object> extends DataState<Props> {
  component: ComponentType<Props>;
  fallback?: ReactNode;
}

/** Any props-based card or section can consume its own API Promise independently. */
export function ComponentBoundary<Props extends object>({
  component: Content,
  fallback = <SectionSkeleton />,
  ...state
}: ComponentBoundaryProps<Props>) {
  return (
    <DataBoundary {...state} fallback={fallback}>
      {(props) => <Content {...props} />}
    </DataBoundary>
  );
}
