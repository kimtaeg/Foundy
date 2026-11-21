"use client";
import { useApiBridge } from "@/hooks/useApiBridge";
import { isFeaturePage, resolveApplicationPage } from "@/lib/routes";
import { createFoundyStore } from "@/lib/store/create-foundy-store";
import { type FoundyContextValue } from "@/types/app";
import { type FoundyStore } from "@/types/foundy";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Connects the browser model lifecycle and Next routes to application actions. */
export function useFoundyState(): FoundyContextValue {
  const [engine, setEngine] = useState<FoundyStore | null>(null);
  const [, refresh] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const initialPath = useRef(pathname);

  useEffect(() => {
    let active = true;
    const instance = createFoundyStore(() => {
      if (active) refresh((version) => version + 1);
    });
    const requested =
      initialPath.current.slice(1) || location.hash.slice(1) || "dashboard";
    const target = resolveApplicationPage(instance.getSnapshot(), requested);
    if (target !== "login" && target !== "signup") instance.navigate(target);
    if (initialPath.current !== `/${target}`) router.replace(`/${target}`);
    setEngine(instance);
    return () => {
      active = false;
      instance.destroy();
    };
  }, [router]);

  useEffect(() => {
    if (!engine) return;
    const snapshot = engine.getSnapshot();
    const page = pathname.slice(1);
    const target = resolveApplicationPage(snapshot, page);
    if (target !== page) {
      router.replace(`/${target}`);
      return;
    }
    if (isFeaturePage(page) && snapshot.currentPage !== page)
      engine.navigate(page);
  }, [engine, pathname, router]);

  const baseSnapshot = engine?.getSnapshot() ?? null;
  const uid = baseSnapshot?.uid ?? null;
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // 비동기 로그인(아이디·비밀번호)이 끝나 로그인 상태가 바뀌면 그에 맞는 화면 경로로 옮긴다.
  useEffect(() => {
    if (!engine) return;
    const current = engine.getSnapshot();
    const requested = current.uid ? current.currentPage : pathRef.current.slice(1);
    const target = resolveApplicationPage(current, requested);
    if (pathRef.current !== `/${target}`) router.replace(`/${target}`);
  }, [engine, uid, router]);

  const api = useApiBridge(engine, baseSnapshot?.uid ?? null);
  // 서버 데이터로 그리는 동안 알림 목록도 서버 알림을 쓴다.
  const snapshot =
    baseSnapshot && api.model
      ? { ...baseSnapshot, notifications: api.model.notifications, storeName: api.model.S.name }
      : baseSnapshot;

  const syncRoute = () => {
    if (!engine) return;
    const snapshot = engine.getSnapshot();
    // 로그인 전에는 지금 경로를 기준으로 판단해 /signup 이 /login 으로 되돌아가지 않게 한다.
    const requested = snapshot.uid ? snapshot.currentPage : pathname.slice(1);
    const target = resolveApplicationPage(snapshot, requested);
    if (pathname !== `/${target}`) router.push(`/${target}`);
  };

  return {
    engine,
    snapshot,
    api: api.model,
    apiPending: api.pending,
    onEvent(type, event) {
      if (!api.handleEvent(type, event)) engine?.handleEvent(type, event);
      syncRoute();
    },
    navigate(page) {
      engine?.navigate(page);
      syncRoute();
    },
    logout() {
      engine?.logout();
      syncRoute();
    },
    openNotification(id) {
      if (!api.openNotification(id)) engine?.openNotification(id);
      syncRoute();
    },
  };
}
