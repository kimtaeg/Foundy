"use client";
import { type FoundyContextValue } from "@/types/app";
import { createContext } from "react";

export const FoundyContext = createContext<FoundyContextValue | null>(null);
