import { createStoreApi, type ApiSession } from "@/lib/api/foundy-api";
import type { ApiGrants } from "@/lib/api/types";

const pendingRefreshes = new Map<string, Promise<ApiGrants>>();

/** Reuse an in-flight refresh if the user returns to this page before it finishes. */
export function refreshGrants(session: ApiSession, sessionKey: string) {
  const pending = pendingRefreshes.get(sessionKey);
  if (pending) return pending;
  const request = createStoreApi(session).refreshGrants().finally(() => pendingRefreshes.delete(sessionKey));
  pendingRefreshes.set(sessionKey, request);
  return request;
}
