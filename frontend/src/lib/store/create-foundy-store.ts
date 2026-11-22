import { downloadChecklistCalendar } from "@/lib/checklist-calendar";
import { ACTLBL, CALLQ } from "@/data/chat";
import { CATCOLOR, GROUPS, OFFS, TASK_LINKS, X_DEFS } from "@/data/checklist";
import { CONTACT } from "@/data/contacts";
import { GRANTS, GRANT_EXCLUDED, RES } from "@/data/grants";
import { compLevel, density } from "@/data/market";
import { STEPS_DECIDED, STEPS_UNDECIDED } from "@/data/onboarding";
import { VL } from "@/data/report";
import { DEMO_STORE, EMPTY_STORE, IMP, MPF, REGIONS } from "@/data/store";
import { createAuthActions } from "@/lib/actions/auth";
import { logoutServer } from "@/lib/api/auth";
import { apiEnabled, ApiError, apiFetch } from "@/lib/api/client";
import { clearSession, createStoreApi, loadSession, saveSession } from "@/lib/api/foundy-api";
import { readServerIdentity, signInWithServer, signUpWithServer } from "@/lib/auth/server-sign-in";
import { createServerOnboarding, SERVER_STEPS } from "@/lib/onboarding/server-onboarding";
import { createDemoSignIn } from "@/lib/auth/demo-sign-in";
import { createChatActions } from "@/lib/actions/chat";
import { createChecklistActions } from "@/lib/actions/checklist";
import { createGrantsActions } from "@/lib/actions/grants";
import { createMarketActions } from "@/lib/actions/market";
import { createNavigationActions } from "@/lib/actions/navigation";
import { createOnboardingActions } from "@/lib/actions/onboarding";
import { createProfileActions } from "@/lib/actions/profile";
import { createReportActions } from "@/lib/actions/report";
import { documentsOf } from "@/data/documents";
import { createAlertSelectors } from "@/lib/alerts/alert-selectors";
import { createReplyModel } from "@/lib/chat/reply-model";
import { createChatRequest } from "@/lib/chat/chat-request";
import { createInitialChatState } from "@/lib/chat/chat-state";
import { createTasks } from "@/lib/checklist/tasks";
import { D, addDays, dday, diffDays, iso, pad, realToday } from "@/lib/date";
import { won } from "@/lib/format";
import { provLabel } from "@/lib/format-provider";
import { createOnboardingWorkflow } from "@/lib/onboarding/onboarding-workflow";
import { createProfileSelectors } from "@/lib/profile/profile-selectors";
import { createProfileWorkflow } from "@/lib/profile/profile-workflow";
import { buildCards as buildReportCards } from "@/lib/report/build-report-cards";
import { getReportCardModel } from "@/lib/report/card-model";
import { createFollowUp } from "@/lib/report/follow-up";
import { createReportSelectors } from "@/lib/report/report-selectors";
import { createBrowserStorage } from "@/lib/storage/browser-storage";
import { createUserRepository } from "@/lib/storage/user-repository";
import { createTaskScope } from "@/lib/store/task-scope";
import type { ActionHandlers } from "@/types/actions";
import { type DialogContent } from "@/types/dialog";
import {
  type FeatureContextFactories,
  type FeatureContextMap,
  type FeatureContextPage,
} from "@/types/features";
import { type FoundySnapshot, type FoundyStore } from "@/types/foundy";
import type { OnboardingAnswers } from "@/types/onboarding";
import type { ProfileFieldEdit } from "@/types/profile";
import { type GrantFilters } from "@/types/grants";
import { type Store } from "@/types/store";

const emptySetupAnswers: OnboardingAnswers = { alcohol: null, terrace: null, employees: null };
type ServerIdentity = Awaited<ReturnType<typeof readServerIdentity>>;

/** Composes account-scoped state and commands; React owns all rendering. */
export function createFoundyStore(onChange: () => void): FoundyStore {
  const realDocument = globalThis.document;
  const document = realDocument;
  const listeners: Record<string, Array<(event: any) => void>> = {};
  const lifecycle = createTaskScope(onChange);
  const { notify, cancelPending, setTimeout, clearTimeout } = lifecycle;
  const listen = (type: string, callback: (event: any) => void) => {
    (listeners[type] ??= []).push(callback);
  };
  let modalState: FoundySnapshot["modal"] | { resultFor: string } = null;
  let profileEdit: ProfileFieldEdit | undefined;
  let toastMessage = "";
  let toastId = 0;
  const closeModal = () => {
    modalState = null;
  };
  const browserWindow = globalThis.window;
  const pages: Record<string, string> = {
    dashboard: "내 가게 홈",
    report: "점검 리포트",
    checklist: "개업 체크리스트",
    docs: "서류함",
    grants: "지원사업",
    sites: "상권 분석",
    register: "가게 정보 등록",
    mypage: "마이페이지",
  };
  let currentPage = "dashboard";
  let reportFilter = "all";
  let checkView: "timeline" | "category" | "calendar" = "timeline";
  const navigateTo = (page: string) => {
    if (modalState && (
      "resultFor" in modalState ||
      modalState.content.kind === "option-choices" ||
      modalState.content.kind === "option-confirm"
    )) closeModal();
    if (page !== "mypage") profileEdit = undefined;
    currentPage = page;
    recalc();
    if (page === "register") prepareRegistration();
  };
  const toast = (message: string) => {
    toastMessage = message;
    toastId += 1;
    notify();
  };
  const modal = (title: string, content: DialogContent) => {
    modalState = { title, content };
  };
  const tasks = createTasks();
  const findElement = (id: string): any => realDocument.getElementById(id);

  const storage = createBrowserStorage();
  let userId: string | null = null;
  const { take, put } = createUserRepository(storage, () => userId);
  let store: Store = { ...EMPTY_STORE };
  let reportStates: any = {};
  let extraTaskCompletion: Record<string, boolean> = {};
  let simulation = "now";
  let readAlerts: Record<string, boolean | 1> = {};
  let candidateAddresses: any[] = [];
  let followUpLog: any[] = [];
  let changeLog: any[] = [];
  let automaticTasks: Record<string, boolean> = {};
  let currentPrice = "";
  let onboarding: any = { step: "choose", path: null, done: [], timers: [] };
  let setupIdentity: ServerIdentity | null = null;
  let calendar: any = { y: null, m: null, sel: null };
  let grantFilters: GrantFilters = {
    res: "all",
    cat: "all",
  };
  let market: { sel: string | null; r: number; cat: string } = {
    sel: null,
    r: 300,
    cat: "all",
  };
  const saveS: any = () => put("store", store);
  function loadState(): any {
    profileEdit = undefined;
    store = take(
      "store",
      userId === "demo" ? { ...DEMO_STORE } : { ...EMPTY_STORE },
    );
    if (store.location !== "decided") {
      store.location = "decided";
      if (store.onboarded && !store.address) store.onboarded = false;
    }
    automaticTasks = take("autochk", {});
    currentPrice = take("myprice", "");
    reportStates = take("rs", {});
    extraTaskCompletion = take("xdone", {});
    simulation = take("sim", "now");
    readAlerts = take("alertread", {});
    candidateAddresses = take("candx", []);
    followUpLog = take("nextlog", []);
    changeLog = take("chglog", []);
    const td: any = take(
      "tasksdone",
      userId === "demo" ? { "c-03": true, "c-05": true } : {},
    );
    tasks.forEach((t: any) => {
      t.done = !!td[t.id];
    });
    chat = createInitialChatState();
    calendar = { y: null, m: null, sel: null };
    market = { sel: null, r: 300, cat: "all" };
    grantFilters = { res: "all", cat: "all" };
    onboarding = { step: "choose", path: null, done: [], timers: [] };
    reportFilter = "all";
    checkView = "timeline";
  }
  /* ---------- 리포트 카드 ---------- */
  const buildCards = () => buildReportCards(store);
  const {
    eff: effectiveStore,
    ev: verdictFor,
    curAction: actionFor,
    pendingDecisions,
  } = createReportSelectors({
    get S() {
      return store;
    },
    buildCards,
    get RS() {
      return reportStates;
    },
  });
  /* ---------- 체크리스트 데이터 ---------- */
  function recalc(): any {
    if (!store.opening) return;
    const o: any = D(store.opening);
    tasks.forEach((t: any, i: any) => {
      t.due = iso(addDays(o, OFFS[i]));
    });
  }
  function allTasks(): any {
    const e: any = effectiveStore();
    const o: any = D(store.opening);
    const base: any = tasks.map((t: any) => ({
      ...t,
      task:
        t.id === "c-04"
          ? (e.alcohol ? "일반음식점" : "휴게음식점") +
            " 영업신고에 필요한 서류 준비"
          : t.task,
    }));
    const ids: any = [...e.extra];
    const ex: any = [...new Set(ids)].map((id: any) => ({
      id,
      ...X_DEFS[id],
      due: iso(addDays(o, X_DEFS[id].off)),
      done: !!extraTaskCompletion[id],
      _x: true,
    }));
    return [...base, ...ex]
      .filter((t: any) => !(t.category === "고용" && !store.employees))
      .sort((a: any, b: any) => (a.due < b.due ? -1 : 1));
  }
  const taskCount: any = () => {
    const l: any = allTasks();
    return { done: l.filter((t: any) => t.done).length, total: l.length };
  };
  function applyChoice(id: string, oid: string): boolean {
    const c: any = buildCards().find((x: any) => x.id === id);
    const o: any = c && c.options.find((x: any) => x.id === oid);
    if (!o) return false;
    reportStates[id] = {
      chosen: oid,
      action: "pending",
      reply: (reportStates[id] && reportStates[id].reply) || "",
      added: o.fx && o.fx.addTask ? [o.fx.addTask] : [],
    };
    put("rs", reportStates);
    if (o.fx && o.fx.main) {
      store.mainManual = null;
      saveS();
    }
    return true;
  }
  function evidenceModal(id: any): any {
    const c: any = buildCards().find((x: any) => x.id === id);
    if (!c) return;
    modal("판정 근거", {
      kind: "evidence",
      items: c.evidence,
    });
  }
  /* ---------- 체크리스트 ---------- */
  function ensureCal(): any {
    if (calendar.y != null) return;
    const l: any = allTasks();
    const d: any = D(l.length ? l[0].due : store.opening);
    calendar.y = d.getFullYear();
    calendar.m = d.getMonth();
  }
  function calEvents(): any {
    const map: any = {};
    const add: any = (ds: any, ev: any) => {
      (map[ds] = map[ds] || []).push(ev);
    };
    allTasks().forEach((t: any) =>
      add(t.due, {
        t: t.task,
        cat: t.category,
        id: t.id,
        done: t.done,
        kind: "task",
      }),
    );
    GRANTS.filter((g: any) => g.deadline && g.res !== "unknown").forEach(
      (g: any) =>
        add(g.deadline, {
          t: "지원사업 마감 · " + g.title,
          cat: "정책",
          id: g.id,
          done: false,
          kind: "grant",
        }),
    );
    add(store.opening, {
      t: "개업일",
      cat: "개업",
      id: "open",
      done: false,
      kind: "open",
    });
    return map;
  }
  function icsDownload() {
    downloadChecklistCalendar(userId ?? "local", store.opening, allTasks());
    toast(".ics 파일을 내려받았어요");
  }
  /* ---------- 알림 센터 ---------- */
  const { alertsFor } = createAlertSelectors({
    get S() {
      return store;
    },
    get SIM() {
      return simulation;
    },
    get NEXTLOG() {
      return followUpLog;
    },
    get CHGLOG() {
      return changeLog;
    },
    pendingDecisions,
    allTasks,
  });
  const ALT: any = {
    decision: "결정 필요",
    next: "다음 할 일",
    deadline: "마감 임박",
    change: "변경 감지",
    grant: "지원사업",
  };
  function grantModal(id: any): any {
    const g = GRANTS.find((x: any) => x.id === id);
    if (!g) return;
    modal(g.title, {
      kind: "grant",
      grant: g,
      deadline: g.deadline ? dday(g.deadline) : "일정 미정",
      result: { label: RES[g.res][0], tone: RES[g.res][1] },
    });
  }
  /* ---------- 상권 분석 ---------- */
  /* ---------- 등록 · 입지 분기 ---------- */
  const { clearTimers, prepareRegistration, runAnalysis, readForm } =
    createOnboardingWorkflow({
      get W() {
        return onboarding;
      },
      clearTimeout,
      setTimeout,
      get currentPage() {
        return currentPage;
      },
      get S() {
        return store;
      },
      get RS() {
        return reportStates;
      },
      set RS(value) {
        reportStates = value;
      },
      put,
      get X() {
        return extraTaskCompletion;
      },
      set X(value) {
        extraTaskCompletion = value;
      },
      get CANDX() {
        return candidateAddresses;
      },
      set CANDX(value) {
        candidateAddresses = value;
      },
      get NEXTLOG() {
        return followUpLog;
      },
      set NEXTLOG(value) {
        followUpLog = value;
      },
      tasks,
      $: findElement,
      saveS,
    });

  /* ---------- AI 상담 (예시 응답: 규칙 기반 시뮬레이션) ---------- */
  let chat = createInitialChatState();
  let replyFocus: string | null | undefined;
  let chatOpen = false;
  const cardShort: any = (c: any) =>
    (
      ({
        building_use: "건물 용도·주류",
        trademark_similar: "상호·상표",
        building_violation: "위반건축물",
        permit_docs: "영업신고 서류",
        labeling: "표시 의무",
      }) as any
    )[c.check] || c.title.slice(0, 12);
  const A: any = (o: any) =>
    Object.assign(
      {
        role: "a",
        kind: "grounded",
        text: "",
        cites: [],
        acts: [],
        follow: [],
        contacts: [],
        call: null,
      },
      o,
    );
  const optList: any = (c: any) =>
    c.options
      .map((o: any, i: any) => "①②③④"[i] + " " + o.label + ": " + o.summary)
      .join("\n");
  const bizName: any = () =>
    effectiveStore().alcohol ? "일반음식점" : "휴게음식점";
  function callSteps(c: any): any {
    const addr: any = store.address + " " + store.detail,
      qs: any = (
        CALLQ[c.check] || ["문의 내용을 확인하고 싶습니다. [확인 필요]"]
      ).map((q: any) => q.replace("{biz}", bizName()));
    const who: any = CONTACT[c.contact] ? CONTACT[c.contact].name : "담당 부서";
    return {
      who,
      qs,
      steps: [
        "“안녕하세요, 카페 창업을 준비 중인 예비 창업자입니다. " +
          who +
          " 담당자를 연결해 주실 수 있을까요?”",
        "“" +
          addr +
          " 건물과 관련해 확인하고 싶은 게 있어 전화드렸습니다.” (건물 주소를 먼저 말하면 담당자가 조회하기 쉬워요)",
        "아래 “꼭 물어볼 것”을 위에서부터 하나씩 묻고, 답을 메모하세요.",
        "마지막으로 담당자 성함과 서면 회신이 가능한지 확인하세요.",
      ],
    };
  }
  const { reply, suggestions } = createReplyModel({
    get S() {
      return store;
    },
    get RS() {
      return reportStates;
    },
    optList,
    A,
    pendingDecisions,
    curAction: actionFor,
    allTasks,
    tasks,
    cardShort,
    buildCards,
    get CH() {
      return replyFocus === undefined ? chat : { ...chat, focus: replyFocus };
    },
  });
  const { send: sendChat, stop: stopChat, retry: retryChat } = createChatRequest({
    getState: () => chat,
    reply: (question, focus) => {
      replyFocus = focus;
      try {
        return reply(question);
      } finally {
        replyFocus = undefined;
      }
    },
    schedule: setTimeout,
    cancelTimer: clearTimeout,
  });
  function applyAct(mi: any, ai: any): any {
    const a: any = chat.msgs[mi]?.acts?.[ai];
    if (!a || a.state) return;
    if (a.type === "update_store") {
      const before: any = store.opening;
      a.state = "applied";
      a.result = [
        "개업일 " + before + " → " + a.payload.date,
        "체크리스트 " + allTasks().length + "개 항목의 날짜를 다시 계산했어요",
      ];
      store.opening = a.payload.date;
      saveS();
      recalc();
      calendar.y = null;
      toast("개업일이 변경됐어요 · 체크리스트가 다시 계산됐어요");
    } else if (a.type === "choose_option") {
      a.state = "applied";
      a.result = ["점검 리포트에 반영했어요. ‘다음’을 누르면 변경 내용을 확인할 수 있어요."];
      applyChoice(a.payload.id, a.payload.o);
    } else if (a.type === "check_item") {
      a.state = "applied";
      a.result = ["“" + a.payload.task + "”를 완료로 표시했어요"];
      setTaskDone(a.payload.id, true);
    }
  }
  /* ---------- 계정 · 마이페이지 · 다음 할 일 ---------- */
  const profile: any = () => take("profile", { name: "", provider: "" });
  function login(uid: string, name: string, provider: string, remote?: ServerIdentity) {
    cancelPending();
    userId = uid;
    storage.set("foundy-session", JSON.stringify({ uid, name, provider }));
    if (!take("profile", null))
      put("profile", { name, provider, joined: iso(realToday()) });
    loadState();
    if (remote) {
      put("profile", { ...profile(), name, provider });
      const ready = remote.setup.status === "ready";
      store = {
        ...(ready ? EMPTY_STORE : store),
        ...(remote.storeName ? { name: remote.storeName } : {}),
        ...(remote.storeOpening ? { opening: remote.storeOpening } : {}),
        onboarded: ready,
      };
      setupIdentity = ready ? null : remote;
      saveS();
    }
    enter();
    if (setupIdentity) {
      onboarding.answers = setupAnswersFromDraft();
      void hydrateSetup();
    }
  }
  function enter(): any {
    if (!store.onboarded) {
      onboarding = { step: "choose", path: null, done: [], timers: [] };
      prepareRegistration();
      navigateTo(apiEnabled() ? "mypage" : "register");
      browserWindow.scrollTo(0, 0);
      return;
    }
    recalc();
    navigateTo("dashboard");
    browserWindow.scrollTo(0, 0);
  }
  function logout(message = "로그아웃했어요"): any {
    if (apiEnabled()) void logoutServer();
    cancelPending();
    closeModal();
    clearTimers();
    storage.del("foundy-session");
    userId = null;
    setupIdentity = null;
    chatOpen = false;
    toast(message);
  }
  /* ----- 점검 리포트 ↔ 체크리스트 연동 ----- */
  const cardDone: any = (cid: any) => {
    const st: any = reportStates[cid];
    return !!(st && st.action === "done");
  };
  const taskDone: any = (id: any) => {
    const t: any = tasks.find((x: any) => x.id === id);
    return t ? !!t.done : !!extraTaskCompletion[id];
  };
  function setTaskDone(id: any, v: any): any {
    const t: any = tasks.find((x: any) => x.id === id);
    if (t) {
      t.done = v;
      put(
        "tasksdone",
        Object.fromEntries(
          tasks.filter((x: any) => x.done).map((x: any) => [x.id, true]),
        ),
      );
    } else {
      extraTaskCompletion[id] = v;
      put("xdone", extraTaskCompletion);
    }
  }
  function syncLinks(): any {
    const out: any = [],
      all: any = allTasks();
    Object.entries<any>(TASK_LINKS).forEach(([tid, cids]: any) => {
      const t: any = all.find((x: any) => x.id === tid);
      if (!t) return;
      const ok: any = cids.every(cardDone),
        cur: any = taskDone(tid);
      if (ok && !cur) {
        setTaskDone(tid, true);
        automaticTasks[tid] = true;
        out.push({ id: tid, task: t.task });
      } else if (!ok && cur && automaticTasks[tid]) {
        setTaskDone(tid, false);
        delete automaticTasks[tid];
      }
    });
    put("autochk", automaticTasks);
    return out;
  }
  /* ----- 실행·완료 뒤 다음 할 일 ----- */
  const { nextSteps, logNext, showNext } = createFollowUp({
    buildCards,
    get S() {
      return store;
    },
    get RS() {
      return reportStates;
    },
    pendingDecisions,
    curAction: actionFor,
    cardShort,
    allTasks,
    get NEXTLOG() {
      return followUpLog;
    },
    set NEXTLOG(value) {
      followUpLog = value;
    },
    put,
    setTimeout,
    document,
  });

  /* ----- 마이페이지 ----- */
  const {
    mpBase: currentProfileStore,
    mpDiff: getProfileChanges,
    mpImpacts: getProfileImpacts,
    resetList,
    mpValidate,
  } = createProfileSelectors({
    eff: effectiveStore,
    get S() {
      return store;
    },
    get normMp() {
      return normMp;
    },
    buildCards,
    get RS() {
      return reportStates;
    },
    cardShort,
  });
  const num: any = (v: any) => Number(v) || 0;
  const normMp: any = (k: any, v: any) =>
    k === "birth" || k === "funds"
      ? k === "funds" && (v == null || String(v).trim() === "")
        ? null
        : num(v)
      : k === "alcohol" || k === "terrace" || k === "employees"
        ? !!v
        : String(v == null ? "" : v).trim();
  const formatProfileValue: any = (k: any, v: any) =>
    k === "alcohol" || k === "terrace" || k === "employees"
      ? v
        ? "네"
        : "아니요"
      : k === "location"
        ? v === "decided"
          ? "자리 확정"
          : "자리 미정"
        : k === "funds"
          ? v == null || String(v).trim() === ""
            ? "(없음)"
            : won(v)
          : String(v == null ? "" : v).trim() || "(비어 있음)";
  const { applyMp, wipeStore } = createProfileWorkflow({
    mpDiff: getProfileChanges,
    toast,
    mpValidate,
    mpImpacts: getProfileImpacts,
    resetList,
    fmtMp: formatProfileValue,
    get RS() {
      return reportStates;
    },
    set RS(value) {
      reportStates = value;
    },
    get NEXTLOG() {
      return followUpLog;
    },
    set NEXTLOG(value) {
      followUpLog = value;
    },
    get S() {
      return store;
    },
    set S(value) {
      store = value;
    },
    num,
    saveS,
    put,
    syncLinks,
    recalc,
    get CAL() {
      return calendar;
    },
    get CHGLOG() {
      return changeLog;
    },
    set CHGLOG(value) {
      changeLog = value;
    },
    get W() {
      return onboarding;
    },
    set W(value) {
      onboarding = value;
    },
    runAnalysis,
    goto: navigateTo,
    cancelPending,
    get X() {
      return extraTaskCompletion;
    },
    set X(value) {
      extraTaskCompletion = value;
    },
    get CANDX() {
      return candidateAddresses;
    },
    set CANDX(value) {
      candidateAddresses = value;
    },
    get AUTO() {
      return automaticTasks;
    },
    set AUTO(value) {
      automaticTasks = value;
    },
    get PRICE() {
      return currentPrice;
    },
    set PRICE(value) {
      currentPrice = value;
    },
    tasks,
    get CH() {
      return chat;
    },
    set CH(value) {
      chat = value;
    },
    closeModal,
  });

  /* ---------- 라우팅 ---------- */
  const toggleTask = function (id: any) {
    if (automaticTasks[id]) {
      delete automaticTasks[id];
      put("autochk", automaticTasks);
    }
    const t: any = tasks.find((x: any) => x.id === id);
    if (t) {
      t.done = !t.done;
      put(
        "tasksdone",
        Object.fromEntries(
          tasks.filter((x: any) => x.done).map((x: any) => [x.id, true]),
        ),
      );
    } else {
      extraTaskCompletion[id] = !extraTaskCompletion[id];
      put("xdone", extraTaskCompletion);
    }
    toast("체크리스트 상태가 변경되었습니다");
  };
  /* ---------- 이벤트 ---------- */
  listen("submit", (e: any) => {
    if (e.target.id === "nxForm") {
      e.preventDefault();
      if (onboarding.saving) return;
      readForm();
      if (apiEnabled()) void serverRegistration.saveProfile();
      else {
        onboarding.step = 2;
        prepareRegistration();
      }
    }
    if (e.target.matches('[data-nx-form="cand"]')) {
      e.preventDefault();
      const v: any = findElement("candAddr").value.trim();
      if (!v) return;
      if (candidateAddresses.length >= 3) {
        toast("후보는 최대 3곳이에요");
        return;
      }
      candidateAddresses.push(v);
      put("candx", candidateAddresses);
      toast("후보를 추가했어요");
    }
  });
  const auth = createAuthActions({
    logout, toast, profile, put, LS: storage,
    get UID() { return userId; },
  });
  const profileEditor = createProfileActions({
    currentStore: currentProfileStore,
    accountName: () => profile().name,
    saveAccountName: auth.saveAccountName,
    setEdit: (edit) => { profileEdit = edit; },
    applyMp, modal, toast, wipeStore,
  });
  const actionHandlers: ActionHandlers = {
    ...createNavigationActions({
      goto: navigateTo,
      setTimeout,
      $: findElement,
    }),
    ...createReportActions({
      get reportFilter() {
        return reportFilter;
      },
      set reportFilter(value) {
        reportFilter = value;
      },
      buildCards,
      modal,
      closeModal,
      applyChoice,
      openOptionResult: (id) => {
        modalState = { resultFor: id };
      },
      get RS() {
        return reportStates;
      },
      put,
      logNext,
      syncLinks,
      toast,
      showNext: (id) => {
        if (!modalState || !("resultFor" in modalState)) showNext(id);
      },
      $: findElement,
      evidenceModal,
    }),
    ...createChecklistActions({
      get checkView() {
        return checkView;
      },
      set checkView(value) {
        checkView = value;
      },
      ensureCal,
      get CAL() {
        return calendar;
      },
      icsDownload,
      modal,
      get S() {
        return store;
      },
    }),
    ...createGrantsActions({
      get G() {
        return grantFilters;
      },
      grantModal,
    }),
    ...createMarketActions({
      get MAP() {
        return market;
      },
      get S() {
        return store;
      },
      saveS,
      toast,
      get CANDX() {
        return candidateAddresses;
      },
      set CANDX(value) {
        candidateAddresses = value;
      },
      put,
      modal,
    }),
    ...auth.actions,
    ...profileEditor.actions,
    ...createOnboardingActions({
      clearTimers,
      get W() {
        return onboarding;
      },
      set W(value) {
        onboarding = value;
      },
      goto: navigateTo,
      prepareRegistration,
      $: findElement,
      get S() {
        return store;
      },
      set S(value) {
        store = value;
      },
      saveS,
      runAnalysis,
      recalc,
      window,
      get RS() {
        return reportStates;
      },
      set RS(value) {
        reportStates = value;
      },
      put,
    }),
    ...createChatActions({
      get CH() {
        return chat;
      },
      goto: navigateTo,
      setChatOpen: (open: boolean | "toggle") => {
        chatOpen = open === "toggle" ? !chatOpen : open;
      },
      sendChat,
      stopChat,
      retryChat,
      applyAct,
      buildCards,
      get RS() {
        return reportStates;
      },
      put,
      A,
      logNext,
      toast,
    }),
  };
  listen("click", (event: any) => {
    const button = event.target.closest("[data-nx]") as HTMLElement | null;
    if (!button || button.tagName === "SELECT") return;
    const handler = actionHandlers[button.dataset.nx || ""];
    if (handler?.(button)) event.preventDefault();
  });
  listen("input", (e: any) => {
    const t: any = e.target;
    if (t.dataset && t.dataset.price) {
      currentPrice = t.value;
      put("myprice", currentPrice);
      return;
    }
    if (t.id === "chatIn") chat.draft = t.value;
    else if (t.id && t.id.indexOf("callmemo-") === 0)
      chat.memo[t.id.slice(9)] = t.value;
  });
  listen("submit", (e: any) => {
    if (e.target.dataset.profileField) {
      e.preventDefault();
      const value = new FormData(e.target).get("value");
      if (profileEdit && profileEdit.field === e.target.dataset.profileField && typeof value === "string") {
        profileEditor.saveField(profileEdit, value);
      }
      return;
    }
    if (e.target.id === "nxChat") {
      e.preventDefault();
      sendChat(findElement("chatIn").value);
      return;
    }
    if (e.target.id === "nxDate") {
      e.preventDefault();
      store.opening = findElement("nxDateVal").value;
      saveS();
      recalc();
      closeModal();
      calendar.y = null;
      toast("개업일이 변경됐어요 · 체크리스트가 다시 계산됐어요");
    }
    if (e.target.id === "nxPick") {
      e.preventDefault();
      store.address = findElement("pickAddr").value;
      store.detail = findElement("pickFloor").value;
      store.location = "decided";
      saveS();
      closeModal();
      onboarding.path = "decided";
      runAnalysis();
      navigateTo("register");
      toast("주소를 확정했어요 · 점검을 시작합니다");
    }
  });
  /* ---------- 초기화 ---------- */
  function acceptIdentity(identity: ServerIdentity) {
    if (lifecycle.disposed || loadSession()?.token !== identity.session.token) return;
    if (loadSession()?.storeId !== identity.session.storeId) saveSession(identity.session);
    login(identity.uid, identity.name, identity.provider, identity);
    notify();
  }

  function setupAnswersFromDraft(): OnboardingAnswers {
    const saved = take("setupAnswers", emptySetupAnswers) as OnboardingAnswers;
    return {
      alcohol: typeof saved.alcohol === "boolean" ? saved.alcohol : null,
      terrace: typeof saved.terrace === "boolean" ? saved.terrace : null,
      employees: typeof saved.employees === "boolean" ? saved.employees : null,
    };
  }

  async function hydrateSetup() {
    const identity = setupIdentity;
    if (!identity?.session.storeId || onboarding.loading) return;
    const { session, setup } = identity;
    const current = () => !lifecycle.disposed && setupIdentity === identity && loadSession()?.token === session.token;
    Object.assign(onboarding, { loading: true, error: undefined });
    notify();
    try {
      const saved = await createStoreApi(session).store();
      if (!current()) return;
      const draft = setupAnswersFromDraft();
      const answers: OnboardingAnswers = {
        alcohol: saved.answers.sells_alcohol ?? draft.alcohol,
        terrace: saved.answers.uses_terrace ?? draft.terrace,
        employees: saved.answers.has_employees ?? draft.employees,
      };
      store = {
        ...EMPTY_STORE,
        name: saved.name, type: saved.business_type_input, address: saved.address, detail: saved.address_detail,
        opening: saved.opening_date, birth: saved.owner_birth_year, region: saved.region ?? "",
        alcohol: answers.alcohol ?? false, terrace: answers.terrace ?? false, employees: answers.employees ?? false,
        funds: saved.answers.funds_krw,
      };
      serverRegistration.rememberProfile(session.token);
      saveS();
      put("setupAnswers", answers);
      const missingProfile = !store.name.trim() || !store.type.trim() || !store.address.trim() || !store.opening;
      Object.assign(onboarding, { step: missingProfile ? 1 : 2, answers, analysisFailed: setup.status === "failed" });
      if (setup.status === "analyzing" && setup.run_id) serverRegistration.resume(session, setup.run_id);
    } catch (error) {
      if (current()) onboarding.error = error instanceof Error ? error.message : "저장한 가게 정보를 불러오지 못했어요.";
    } finally {
      if (current()) {
        onboarding.loading = false;
        notify();
      }
    }
  }

  const serverRegistration = createServerOnboarding({
    currentStore: () => store,
    answers: () => onboarding.answers ?? emptySetupAnswers,
    persist: saveS,
    active: (token) => !lifecycle.disposed && loadSession()?.token === token,
    saving: (saving) => {
      onboarding.saving = saving;
      notify();
    },
    progress: (done, notes, finished) => {
      clearTimers();
      Object.assign(onboarding, { step: 3, done, notes, finished, analysisFailed: false });
      notify();
    },
    questions: () => {
      if (onboarding.step === 3) onboarding.analysisFailed = true;
      onboarding.step = 2;
      notify();
    },
    toast,
    finish: () => {
      setupIdentity = null;
      put("setupAnswers", null);
      store.onboarded = true;
      saveS();
      navigateTo("dashboard");
      browserWindow.dispatchEvent(new Event("foundy:analysis-complete"));
      notify();
    },
    preview: async () => {
      const previous = loadSession();
      const identity = await signInWithServer({ username: "demo", password: "demo" });
      acceptIdentity(identity);
      if (previous) void apiFetch("/api/auth/logout", { method: "POST", token: previous.token }).catch(() => {});
    },
  });
  async function restoreSession() {
    if (!apiEnabled()) return;
    const session = loadSession();
    if (!session) {
      storage.del("foundy-session");
      return;
    }
    try {
      acceptIdentity(await readServerIdentity(session));
    } catch (error) {
      if (lifecycle.disposed || loadSession()?.token !== session.token) return;
      if (!(error instanceof ApiError && error.status === 401)) throw error;
      clearSession();
      storage.del("foundy-session");
      toast(error.message);
    }
  }
  (function boot() {
    if (apiEnabled()) return;
    let ses: any = null;
    try {
      ses = JSON.parse(storage.get("foundy-session") ?? "null");
    } catch {}
    if (ses && typeof ses.uid === "string" && ses.uid) {
      userId = ses.uid;
      loadState();
      enter();
    }
  })();
  function handleEvent(type: string, event: any): any {
    if (lifecycle.disposed) return;
    const target: any = event.target as HTMLElement;
    if (apiEnabled() && !store.onboarded && (currentPage === "register" || currentPage === "mypage")) {
      if (type === "input" && target.id === "fFunds") {
        store.funds = target.value === "" ? null : Number(target.value);
        saveS();
      }
      if (type === "click") {
        const button = target.closest?.("[data-nx]") as HTMLElement | null;
        const command = button?.dataset.nx;
        if (serverRegistration.click(command, onboarding.step, onboarding.finished)) return;
        if (command === "yn") {
          const field = button?.dataset.k;
          if (field === "alcohol" || field === "terrace" || field === "employees") {
            const answers = { ...onboarding.answers, [field]: button?.dataset.v === "1" } as OnboardingAnswers;
            onboarding.answers = answers;
            put("setupAnswers", answers);
          }
        }
      }
    }
    if (type === "click") {
      const navigation: any = target.closest("[data-page]") as HTMLElement;
      const task: any = target.closest("[data-task]") as HTMLElement;
      if (navigation) {
        event.preventDefault();
        navigateTo(navigation.dataset.page);
        notify();
        return;
      }
      if (task) {
        toggleTask(task.dataset.task);
        notify();
        return;
      }
      if (target.id === "closeModal" || target.id === "modal") {
        closeModal();
        notify();
        return;
      }
    }
    if (type === "keydown" && event.key === "Escape") {
      closeModal();
      notify();
      return;
    }
    for (const handler of listeners[type] || []) handler(event);
    notify();
  }
  function currentDialog(): FoundySnapshot["modal"] {
    if (!modalState || "content" in modalState) return modalState;
    const { resultFor } = modalState;
    const context = getViewContext("report");
    const card = context.buildCards().find((item) => item.id === resultFor);
    if (!card) return null;
    const model = getReportCardModel(context, card);
    if (card.options.length) {
      if (!card.options.some((option) => option.id === model.state.chosen)) return null;
      return { title: "선택 결과", content: { kind: "option-result", model } };
    }
    return model.action ? { title: "후속 작업", content: { kind: "option-result", model } } : null;
  }
  function snapshot(): FoundySnapshot {
    return {
      notifications:
        userId && store.onboarded
          ? alertsFor(simulation).map((a: any) => ({
              id: a.id,
              title: a.title,
              body: a.body,
              category: ALT[a.type] || "",
              read: !!readAlerts[a.id],
              destination: a.cta[1],
              focus: a.cta[2] || "",
            }))
          : [],
      chatOpen: !!userId && !!store.onboarded && chatOpen,
      uid: userId,
      onboarded: !!store.onboarded,
      currentPage: !userId ? "login" : currentPage,
      modal: currentDialog(),
      toast: toastMessage,
      toastId,
      userName: userId ? profile().name || "사용자" : "",
      storeName: store.onboarded
        ? effectiveStore().name || "내 가게"
        : "가게 없음",
    };
  }
  const viewContexts: FeatureContextFactories = {
    dashboard: () => {
      return {
        eff: effectiveStore,
        pendingDecisions,
        taskCount,
        alertsFor,
        SIM: simulation,
        AR: readAlerts,
        diffDays,
        D,
        S: store,
        realToday,
        buildCards,
        ev: verdictFor,
        curAction: actionFor,
        RS: reportStates,
        allTasks,
      };
    },
    report: () => {
      return {
        S: store,
        buildCards,
        reportFilter,
        ev: verdictFor,
        RS: reportStates,
        curAction: actionFor,
        CONTACT,
        allTasks,
        TASK_LINKS,
        cardDone,
        AUTO: automaticTasks,
        nextSteps,
        cardShort,
      };
    },
    checklist: () => {
      ensureCal();
      return {
        allTasks,
        taskCount,
        checkView,
        GROUPS,
        documentCount: (taskId: string) => documentsOf(taskId).length,
        dday,
        S: store,
        CAL: calendar,
        ensureCal,
        calEvents,
        CATCOLOR,
        iso,
        realToday,
        pad,
        TASK_LINKS,
        AUTO: automaticTasks,
      };
    },
    docs: () => {
      return { allTasks, dday };
    },
    grants: () => {
      return { GRANTS, G: grantFilters, RES, dday, GRANT_EXCLUDED };
    },
    sites: () => {
      return {
        S: store,
        MAP: market,
        PRICE: currentPrice,
        density,
        compLevel,
        won,
      };
    },
    register: () => {
      prepareRegistration();
      return {
        S: store,
        profile,
        W: onboarding,
        STEPS_UNDECIDED,
        STEPS_DECIDED: apiEnabled() ? SERVER_STEPS : STEPS_DECIDED,
      };
    },
    chat: () => {
      return {
        S: store,
        CH: chat,
        buildCards,
        eff: effectiveStore,
        cardShort,
        VL,
        ev: verdictFor,
        suggestions,
        callSteps,
        CONTACT,
        ACTLBL,
      };
    },
    mypage: () => {
      return {
        edit: profileEdit,
        S: store,
        mpDraft: currentProfileStore,
        profile,
        IMP,
        REGIONS,
        provLabel,
        MPF,
        CHGLOG: changeLog,
        mpDiff: getProfileChanges,
        mpImpacts: getProfileImpacts,
        resetList,
        fmtMp: formatProfileValue,
      };
    },
  };
  function getViewContext<Page extends FeatureContextPage>(
    page: Page,
  ): FeatureContextMap[Page] {
    return viewContexts[page]();
  }
  return {
    getViewContext,
    handleEvent,
    restoreSession,
    retrySetup: () => { void hydrateSetup(); },
    adoptServerStore: (next: Store) => {
      store = { ...next };
      saveS();
      notify();
    },
    signIn: apiEnabled() ? async (credentials) => {
      acceptIdentity(await signInWithServer(credentials));
    } : createDemoSignIn(() => {
      if (lifecycle.disposed) throw new Error("로그인을 다시 시도해 주세요.");
      login("demo", "이서연", "demo");
      notify();
    }),
    async signUp(credentials) {
      acceptIdentity(await signUpWithServer(credentials));
    },
    logout: (message) => {
      logout(message);
      notify();
    },
    openNotification: (id: string) => {
      const alert = alertsFor(simulation).find((item: any) => item.id === id);
      if (!alert) return;
      readAlerts[id] = 1;
      put("alertread", readAlerts);
      navigateTo(alert.cta[1]);
      if (alert.cta[2])
        setTimeout(
          () =>
            realDocument
              .getElementById("result-" + alert.cta[2])
              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          60,
        );
      notify();
    },
    getSnapshot: snapshot,
    openChat: () => {
      chatOpen = true;
      notify();
    },
    navigate: (p: string) => {
      if (!userId) {
        notify();
        return;
      }
      if (!store.onboarded && (!apiEnabled() || p !== "register")) p = apiEnabled() ? "mypage" : "register";
      if (pages[p]) navigateTo(p);
      notify();
    },
    closeModal: () => {
      closeModal();
      notify();
    },
    destroy: lifecycle.destroy,
  };
}
