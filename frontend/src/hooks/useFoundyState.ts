"use client";
import { useApiBridge } from "@/hooks/useApiBridge";
import { useReportApiActions } from "@/hooks/useReportApiActions";
import { useChecklistAlertActions } from "@/hooks/useChecklistAlertActions";
import { toast } from "sonner";
import { VL } from "@/data/report";
import { focusNavigationItem, isFeaturePage, resolveApplicationPage } from "@/lib/routes";
import { createFoundyStore } from "@/lib/store/create-foundy-store";
import { type FoundyContextValue } from "@/types/app";
import type { ChatLaunch } from "@/types/chat";
import { type FoundyStore } from "@/types/foundy";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

/** Connects the browser model lifecycle and Next routes to application actions. */
export function useFoundyState(): FoundyContextValue {
  const [engine, setEngine] = useState<FoundyStore | null>(null);
  const [, refresh] = useState(0);
  const [isNavigating, startNavigation] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const initialPath = useRef(pathname);
  const [startupAttempt, retry] = useState(0);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [dateOwner, setDateOwner] = useState<string | null>(null);
  const chatLaunchId = useRef(0);
  const [chatRequest, setChatRequest] = useState<{ uid: string; launch: ChatLaunch } | null>(null);

  useEffect(() => {
    let active = true;
    const instance = createFoundyStore(() => {
      if (active) refresh((version) => version + 1);
    });
    void instance.restoreSession().then(() => {
      if (!active) return;
      const requested = initialPath.current.slice(1) || location.hash.slice(1) || "dashboard";
      const target = resolveApplicationPage(instance.getSnapshot(), requested);
      if (target !== "login") instance.navigate(target);
      if (initialPath.current !== `/${target}`) router.replace(`/${target}`);
      setEngine(instance);
    }).catch((error: unknown) => {
      if (active) setStartupError(error instanceof Error ? error.message : "계정을 불러오지 못했어요.");
    });
    return () => {
      active = false;
      instance.destroy();
    };
  }, [router, startupAttempt]);

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

  const syncRoute = () => {
    if (!engine) return;
    const snapshot = engine.getSnapshot();
    const target = resolveApplicationPage(snapshot, snapshot.currentPage);
    if (pathname !== `/${target}` || isNavigating) {
      startNavigation(() => router.push(`/${target}`));
    }
  };

  const base = engine?.getSnapshot() ?? null;
  const uid = base?.uid ?? null;
  const onboarded = base?.onboarded ?? false;
  const expire = useCallback((message: string) => {
    setChatRequest(null);
    setDateOwner(null);
    engine?.logout(message);
  }, [engine]);
  const requestedPage = pathname.slice(1);
  const signedInPage = requestedPage === "login" && base?.uid
    ? resolveApplicationPage(base, requestedPage)
    : null;
  const page = signedInPage ?? (requestedPage || "dashboard");
  const calendarOpen = page === "checklist" && engine?.getViewContext("checklist").checkView === "calendar";
  const bridge = useApiBridge(uid, onboarded, page, calendarOpen, expire);
  const api = bridge.model;
  const { handleEvent: handleReportEvent, modal: reportModal, closeModal: closeReportModal } =
    useReportApiActions({ api, refreshApi: bridge.refresh, updateApi: bridge.update, apiActive: bridge.active });
  const { handleChecklistEvent, openApiNotification } =
    useChecklistAlertActions(engine, api, bridge.active, bridge.refresh, bridge.update);
  const opening = api?.checklist?.S.opening;
  const dateModal = opening && uid && dateOwner === uid
    ? { title: "개업 예정일 변경", content: { kind: "opening-date" as const, opening } }
    : null;
  const snapshot = base && bridge.active ? {
    ...base, notifications: api?.notifications ?? [],
    storeName: api?.bundle.store?.effective.name ?? api?.bundle.dashboard?.store.name ?? api?.bundle.me?.store_name ?? base.storeName,
    modal: dateModal ?? reportModal ?? base.modal,
  } : base;

  const route = useRef(pathname);
  route.current = pathname;
  useEffect(() => {
    if (!engine) return;
    const state = engine.getSnapshot();
    const current = route.current.slice(1);
    const destination = resolveApplicationPage(state, current);
    if (current !== destination) router.replace(`/${destination}`);
  }, [engine, uid, onboarded, router]);

  const gated = snapshot?.uid && bridge.active && !snapshot.onboarded
    ? resolveApplicationPage(snapshot, pathname.slice(1))
    : null;
  const target = gated ?? signedInPage
    ?? (isNavigating && snapshot ? resolveApplicationPage(snapshot, snapshot.currentPage) : null);
  return {
    engine,
    snapshot,
    chatLaunch: chatRequest?.uid === uid ? chatRequest.launch : null,
    api, apiActive: bridge.active, setup: bridge.setup, apiPending: bridge.pending, apiError: bridge.error,
    notificationError: bridge.notificationError, notificationsLoading: bridge.notificationsLoading,
    async retryNotifications() { await bridge.refresh(["alerts"]); },
    refreshApi: bridge.refresh, updateApi: bridge.update, startupError,
    retryStartup() { setStartupError(null); retry((attempt) => attempt + 1); },
    closeModal() { setDateOwner(null); closeReportModal(); engine?.closeModal(); },
    pendingPage: target && pathname !== `/${target}` ? target : null,
    async signIn(credentials) {
      if (!engine) throw new Error("로그인 연결을 준비 중이에요.");
      await engine.signIn(credentials);
    },
    async signUp(credentials) {
      if (!engine) throw new Error("회원가입 연결을 준비 중이에요.");
      await engine.signUp(credentials);
    },
    onEvent(type, event) {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-nx]") : null;
      const command = button?.dataset.nx;
      if (bridge.active && type === "click" && command === "editDate") {
        setDateOwner(uid);
        return;
      }
      if (bridge.active && uid && type === "click" && (command === "askchat" || command === "focuschat")) {
        const card = api?.cards.find((item) => item.id === button?.dataset.id);
        const verdict = card && (api?.report?.ev(card) ?? card.base);
        setChatRequest({
          uid,
          launch: {
            id: ++chatLaunchId.current,
            question: command === "askchat" ? button?.dataset.q : undefined,
            focus: card && verdict
              ? { id: card.id, title: card.title, verdict, verdictLabel: VL[verdict] ?? verdict }
              : undefined,
          },
        });
        engine?.openChat();
        return;
      }
      if (bridge.active && type === "click" && (command === "cact" || command === "callsave")) {
        toast("변경할 항목을 해당 페이지에서 저장해 주세요.");
        return;
      }
      if (!handleReportEvent(type, event) && !handleChecklistEvent(type, event)) {
        const destination = bridge.active && type === "click" && command === "cnav" ? button?.dataset.p : undefined;
        const focus = button?.dataset.focus;
        if (destination && focus && isFeaturePage(destination)) {
          engine?.navigate(destination);
          focusNavigationItem(destination, focus);
        } else {
          engine?.handleEvent(type, event);
        }
      }
      syncRoute();
    },
    navigate(page) {
      engine?.navigate(page);
      syncRoute();
    },
    logout() {
      setDateOwner(null);
      setChatRequest(null);
      closeReportModal();
      engine?.logout();
      syncRoute();
    },
    openNotification(id) {
      if (!openApiNotification(id)) engine?.openNotification(id);
      syncRoute();
    },
  };
}
