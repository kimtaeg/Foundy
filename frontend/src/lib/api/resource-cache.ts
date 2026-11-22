import { getApiIdentity, readStoreResources, type ApiSession } from "@/lib/api/foundy-api";
import type { ApiResource, ApiResources } from "@/lib/api/types";

interface ResourceSnapshot {
  bundle: Partial<ApiResources>;
  errors: Partial<Record<ApiResource, unknown>>;
}

export const emptyResources: ResourceSnapshot = { bundle: {}, errors: {} };

export function createResourceCache(session: ApiSession) {
  const identity = getApiIdentity(session.token);
  let snapshot: ResourceSnapshot = identity ? { bundle: { me: identity }, errors: {} } : emptyResources;
  const readers = readStoreResources(session);
  const listeners = new Set<() => void>();
  const revisions = new Map<ApiResource, number>();
  const stale = new Set<ApiResource>();
  const pending = new Map<ApiResource, { revision: number; promise: Promise<unknown> }>();

  const publish = (next: ResourceSnapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };

  function invalidate(keys: readonly ApiResource[]) {
    keys.forEach(key => {
      revisions.set(key, (revisions.get(key) ?? 0) + 1);
      stale.add(key);
    });
  }

  function set<K extends ApiResource>(key: K, value: ApiResources[K], preserveInvalidation = false) {
    const wasStale = stale.has(key);
    invalidate([key]);
    if (!preserveInvalidation || !wasStale) stale.delete(key);
    publish({
      bundle: { ...snapshot.bundle, [key]: value },
      errors: { ...snapshot.errors, [key]: undefined },
    });
  }

  function ensure<K extends ApiResource>(key: K): Promise<unknown> {
    const revision = revisions.get(key) ?? 0;
    const previous = pending.get(key);
    if (previous?.revision === revision) return previous.promise;
    if (!stale.has(key) && snapshot.bundle[key] !== undefined) return Promise.resolve(snapshot.bundle[key]);
    if (snapshot.errors[key]) publish({ ...snapshot, errors: { ...snapshot.errors, [key]: undefined } });

    const current = () => (revisions.get(key) ?? 0) === revision;
    // Reads for an older revision may still finish, but must neither block nor overwrite this one.
    const request = Promise.resolve().then<ApiResources[K] | undefined>(() => current() ? readers[key]() : undefined).then(value => {
      if (current() && value !== undefined) {
        stale.delete(key);
        publish({ bundle: { ...snapshot.bundle, [key]: value }, errors: { ...snapshot.errors, [key]: undefined } });
      }
      return value;
    }).catch((error: unknown) => {
      if (!current()) return;
      publish({ ...snapshot, errors: { ...snapshot.errors, [key]: error } });
      throw error;
    }).finally(() => {
      if (pending.get(key)?.promise === request) pending.delete(key);
    });
    pending.set(key, { revision, promise: request });
    return request;
  }

  return {
    ensure,
    invalidate,
    set,
    isStale: (key: ApiResource) => stale.has(key),
    isReading: (key: ApiResource) => pending.has(key),
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
