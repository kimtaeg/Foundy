import { SyntheticEvent } from "react";

export type ViewEventType = "click" | "input" | "change" | "submit";
export type ViewEventHandler = (
  type: ViewEventType,
  event: SyntheticEvent<HTMLElement>,
) => void;
