import type { ViewEventHandler } from "./events";

/** Pass a resolved API result or a stable Promise created by its data owner. */
export type AsyncData<T> = T | Promise<T>;

export interface DataState<T> {
  data?: AsyncData<T>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/** Serializable data is separate from browser-side interaction handlers. */
export interface DataViewProps<T> extends DataState<T> {
  onEvent?: ViewEventHandler;
}

export type SkeletonVariant =
  | "card"
  | "list"
  | "chart"
  | "form"
  | "table"
  | "map"
  | "navigation"
  | "chat"
  | "text";
