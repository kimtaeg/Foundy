"use client";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { apiEnabled, apiSessionExpiredEvent, type ApiSessionExpired } from "@/lib/api/client";
import { createApiModel } from "@/lib/api/contexts";
import { clearSession, loadSession, sessionSnapshot, subscribeSession } from "@/lib/api/foundy-api";
import { createResourceCache, emptyResources } from "@/lib/api/resource-cache";
import type { ApiResource, ApiResources } from "@/lib/api/types";

const emptySession = () => null;
const noSubscribe = () => () => {};
const getEmptyResources = () => emptyResources;
const ignoreReadError = () => {};

const pageResource: Partial<Record<string, ApiResource>> = {
  dashboard: "dashboard",
  report: "report",
  checklist: "checklist",
  docs: "documents",
  grants: "grants",
  mypage: "store",
  sites: "store",
};

function isVisible(key: ApiResource, { required, onboarded, calendarOpen }: {
  required?: ApiResource; onboarded: boolean; calendarOpen: boolean;
}) {
  return key === "me" || key === required || (onboarded && (key === "alerts" || (key === "grants" && calendarOpen)));
}

export function useApiBridge(uid: string | null, onboarded: boolean, page: string, calendarOpen: boolean, onExpired: (message: string) => void) {
  const sessionKey = useSyncExternalStore(subscribeSession, sessionSnapshot, emptySession);
  const active = apiEnabled() && !!uid;
  const cache = useMemo(() => {
    if (!active || !sessionKey) return null;
    const session = loadSession(uid === "demo" ? "demo" : "account");
    return session ? createResourceCache(session) : null;
  }, [active, sessionKey, uid]);
  const snapshot = useSyncExternalStore(
    cache?.subscribe ?? noSubscribe,
    cache?.getSnapshot ?? getEmptyResources,
    getEmptyResources,
  );
  const model = useMemo(() => cache ? createApiModel(snapshot.bundle) : null, [cache, snapshot.bundle]);
  const required = onboarded ? pageResource[page] : undefined;
  const target = useRef({ required, onboarded, calendarOpen });
  useEffect(() => { target.current = { required, onboarded, calendarOpen }; }, [required, onboarded, calendarOpen]);

  useEffect(() => {
    if (!active) return;
    const expire = (event: Event) => {
      const { token, message } = (event as ApiSessionExpired).detail;
      if (loadSession()?.token !== token) return;
      clearSession();
      onExpired(message);
    };
    window.addEventListener(apiSessionExpiredEvent, expire);
    return () => window.removeEventListener(apiSessionExpiredEvent, expire);
  }, [active, onExpired]);

  useEffect(() => {
    if (!cache) return;
    void cache.ensure("me").catch(ignoreReadError);
    if (required) void cache.ensure(required).catch(ignoreReadError);
    if (onboarded) void cache.ensure("alerts").catch(ignoreReadError);
  }, [cache, onboarded, required]);

  useEffect(() => {
    if (cache && onboarded && calendarOpen) void cache.ensure("grants").catch(ignoreReadError);
  }, [cache, onboarded, calendarOpen]);

  const refresh = useCallback(async (keys?: readonly ApiResource[]) => {
    if (!cache || sessionSnapshot() !== sessionKey) return null;
    const { required } = target.current;
    const affected = keys ?? (required ? [required] : ["me"]);
    cache.invalidate(affected);
    const immediate = [...new Set(affected)].filter(key => isVisible(key, target.current));
    try {
      await Promise.all(immediate.map(cache.ensure));
      return sessionSnapshot() === sessionKey ? createApiModel(cache.getSnapshot().bundle) : null;
    } catch {
      return null;
    }
  }, [cache, sessionKey]);

  const update = useCallback(<K extends ApiResource>(
    key: K, change: (value: ApiResources[K]) => ApiResources[K], invalidateMissing = true, preserveInvalidation = false,
  ) => {
    if (!cache || sessionSnapshot() !== sessionKey) return;
    const value = cache.getSnapshot().bundle[key];
    if (value !== undefined) {
      const next = change(value);
      if (next !== value) {
        cache.set(key, next, preserveInvalidation);
        if (invalidateMissing && preserveInvalidation && cache.isStale(key) &&
          (cache.isReading(key) || isVisible(key, target.current))) void cache.ensure(key).catch(ignoreReadError);
        return;
      }
    }
    if (invalidateMissing && cache.isReading(key)) {
      // A request that started before the write may return the old value even when the UI already shows the new one.
      cache.invalidate([key]);
      void cache.ensure(key).catch(ignoreReadError);
    } else if (invalidateMissing && preserveInvalidation && cache.isStale(key) && isVisible(key, target.current)) {
      void cache.ensure(key).catch(ignoreReadError);
    }
  }, [cache, sessionKey]);

  useEffect(() => {
    if (!active) return;
    const complete = () => { void refresh(["me", "store", "dashboard", "report", "checklist", "documents", "alerts", "grants"]); };
    window.addEventListener("foundy:analysis-complete", complete);
    return () => window.removeEventListener("foundy:analysis-complete", complete);
  }, [active, refresh]);

  const error = required && snapshot.bundle[required] === undefined ? snapshot.errors[required] : null;
  const alertsError = snapshot.errors.alerts;
  return {
    model,
    setup: snapshot.bundle.me?.setup ?? null,
    pending: !!cache && !!required && snapshot.bundle[required] === undefined && !error,
    error: error instanceof Error ? error.message : error ? "화면을 불러오지 못했어요." : null,
    notificationError: alertsError instanceof Error ? alertsError.message : alertsError ? "알림을 불러오지 못했어요." : null,
    notificationsLoading: !!cache && onboarded && snapshot.bundle.alerts === undefined && !alertsError,
    active, refresh, update,
  };
}
