"use client";
import { type ViewEventHandler, type ViewEventType } from "@/types/events";
import { ReactNode, SyntheticEvent } from "react";

export interface EventBoundaryProps {
  children: ReactNode;
  onEvent?: ViewEventHandler;
}

/** Delegates one DOM event once, even when independent feature boundaries nest. */
export function EventBoundary({ children, onEvent }: EventBoundaryProps) {
  const forward = (
    type: ViewEventType,
    event: SyntheticEvent<HTMLDivElement>,
  ) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("[data-foundy-view]") !== event.currentTarget) return;
    if (onEvent) onEvent(type, event);
    else if (type === "submit") event.preventDefault();
  };
  return (
    <div
      data-foundy-view=""
      className="contents"
      onClick={(event) => forward("click", event)}
      onInput={(event) => forward("input", event)}
      onChange={(event) => forward("change", event)}
      onSubmit={(event) => forward("submit", event)}
    >
      {children}
    </div>
  );
}
