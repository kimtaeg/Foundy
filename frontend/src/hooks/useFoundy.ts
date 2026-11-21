"use client";
import { FoundyContext } from "@/providers/FoundyContext";
import { useContext } from "react";

export function useFoundy() {
  const state = useContext(FoundyContext);
  if (!state) throw new Error("FoundyProvider is required");
  return state;
}
