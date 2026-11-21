"use client";
import { useFoundyState } from "@/hooks/useFoundyState";
import { FoundyContext } from "@/providers/FoundyContext";
import { ReactNode } from "react";

export function FoundyProvider({ children }: { children: ReactNode }) {
  const state = useFoundyState();
  return (
    <FoundyContext.Provider value={state}>{children}</FoundyContext.Provider>
  );
}
