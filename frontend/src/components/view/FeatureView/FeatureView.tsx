"use client";
import { EventBoundary } from "@/components/view/EventBoundary";
import type { ViewEventHandler } from "@/types/events";
import { ReactNode } from "react";

export interface FeatureViewProps {
  page: string;
  children: ReactNode;
  onEvent?: ViewEventHandler;
}

export function FeatureView({ page, children, onEvent }: FeatureViewProps) {
  return (
    <section id={`page-${page}`} className="page active">
      <EventBoundary onEvent={onEvent}>{children}</EventBoundary>
    </section>
  );
}
