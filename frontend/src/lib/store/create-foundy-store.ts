import { CATCOLOR, GROUPS, OFFS, TASK_LINKS, X_DEFS } from "@/data/checklist";
import { CONTACT, contactOfAgency } from "@/data/contacts";
import { GRANTS, GRANT_EXCLUDED, RES } from "@/data/grants";
import {
  AREAS,
  EXFOOD,
  FRANCHISE,
  PRICE_EX,
  SHOPS,
  compLevel,
  density,
} from "@/data/market";
import { STEPS_DECIDED, STEPS_UNDECIDED } from "@/data/onboarding";
import { VL } from "@/data/report";
import { DEMO_STORE, EMPTY_STORE, IMP, MPF, REGIONS } from "@/data/store";
import { createAuthActions } from "@/lib/actions/auth";
import { logoutServer } from "@/lib/api/auth";
import { createPasswordAuth } from "@/lib/auth/password-auth";
import { createChatActions } from "@/lib/actions/chat";
import { createChecklistActions } from "@/lib/actions/checklist";
import { createDocumentsActions } from "@/lib/actions/documents";
import { createGrantsActions } from "@/lib/actions/grants";
import { createMarketActions } from "@/lib/actions/market";
import { createNavigationActions } from "@/lib/actions/navigation";
import { createOnboardingActions } from "@/lib/actions/onboarding";
import { createProfileActions } from "@/lib/actions/profile";
import { createReportActions } from "@/lib/actions/report";
import { documentsOf } from "@/data/documents";
import { createAlertSelectors } from "@/lib/alerts/alert-selectors";
import { createTasks } from "@/lib/checklist/tasks";
import { D, addDays, dday, diffDays, iso, pad, realToday } from "@/lib/date";
import { copyDocumentText } from "@/lib/documents/browser";
import { won } from "@/lib/format";
import { provLabel } from "@/lib/format-provider";
import { createOnboardingWorkflow } from "@/lib/onboarding/onboarding-workflow";
import { createProfileSelectors } from "@/lib/profile/profile-selectors";
import { createProfileWorkflow } from "@/lib/profile/profile-workflow";
import { buildCards as buildReportCards } from "@/lib/report/build-report-cards";
import { createFollowUp } from "@/lib/report/follow-up";
import { createReportSelectors } from "@/lib/report/report-selectors";
import { createBrowserStorage } from "@/lib/storage/browser-storage";
import { createUserRepository } from "@/lib/storage/user-repository";
import { createTaskScope } from "@/lib/store/task-scope";
import { type DialogContent } from "@/types/dialog";
import {
  type FeatureContextFactories,
  type FeatureContextMap,
  type FeatureContextPage,
} from "@/types/features";
import { type FoundySnapshot, type FoundyStore } from "@/types/foundy";
import { type GrantFilters } from "@/types/grants";
import { type Store } from "@/types/store";

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
  let modalState: FoundySnapshot["modal"] = null;
  let toastMessage = "";
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
  let toastTimeout: ReturnType<typeof globalThis.setTimeout>;
  const navigateTo = (page: string) => {
    profileDraft = null;
    currentPage = page;
    recalc();
    if (page === "register") prepareRegistration();
  };
  const toast = (message: string) => {
    toastMessage = message;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastMessage = "";
    }, 2800);
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
  let calendar: any = { y: null, m: null, sel: null };
  let grantFilters: GrantFilters = {
    res: "all",
    cat: "all",
    sort: "deadline",
    view: "card",
  };
  let market: { sel: string | null; r: number; cat: string } = {
    sel: null,
    r: 300,
    cat: "all",
  };
  const saveS: any = () => put("store", store);
  function loadState(): any {
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
    calendar = { y: null, m: null, sel: null };
    market = { sel: null, r: 300, cat: "all" };
    grantFilters = { res: "all", cat: "all", sort: "deadline", view: "card" };
    onboarding = { step: "choose", path: null, done: [], timers: [] };
    reportFilter = "all";
    checkView = "timeline";
    profileDraft = null;
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
  /* ---------- 공통 UI ---------- */
  const copyText = (text: string) => {
    void copyDocumentText(text, toast);
  };

  function applyChoice(id: any, oid: any): any {
    const c: any = buildCards().find((x: any) => x.id === id);
    const o: any = c && c.options.find((x: any) => x.id === oid);
    if (!o) return;
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
    toast("“" + o.label + "” 적용 · 변경 내용을 카드에서 확인하세요");
    const el: any = findElement("result-" + id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function evidenceModal(id: any): any {
    const c: any = buildCards().find((x: any) => x.id === id);
    if (!c) return;
    modal("판정 근거", {
      kind: "evidence",
      items: c.evidence,
      date: iso(realToday()),
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
          t: "지원사업 마감 · " + g.title.replace(" (예시 공고)", ""),
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
  function icsDownload(): any {
    const lines: any = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Foundy//Prototype//KO",
    ];
    const evs: any = allTasks().map((t: any) => ({ d: t.due, s: t.task }));
    evs.push({ d: store.opening, s: "개업일" });
    evs.forEach((e: any, i: any) => {
      const d: any = e.d.replace(/-/g, "");
      const n: any = iso(addDays(D(e.d), 1)).replace(/-/g, "");
      lines.push(
        "BEGIN:VEVENT",
        "UID:foundy-" + i + "@prototype",
        "DTSTAMP:" + iso(realToday()).replace(/-/g, "") + "T000000Z",
        "DTSTART;VALUE=DATE:" + d,
        "DTEND;VALUE=DATE:" + n,
        "SUMMARY:" + e.s.replace(/[,;]/g, " "),
        "END:VEVENT",
      );
    });
    lines.push("END:VCALENDAR");
    const blob: any = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const a: any = realDocument.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "foundy-checklist.ics";
    realDocument.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
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
  function mkStats(): any {
    const fr: any = SHOPS.filter((s: any) => FRANCHISE.test(s.name + s.sub));
    return {
      fr,
      ind: SHOPS.length - fr.length,
      dessert: SHOPS.filter((s: any) =>
        /디저트|베이커리|빵/.test(s.sub + s.name),
      ),
      within: (r: any) => SHOPS.filter((s: any) => s.dist <= r).length,
    };
  }
  function pricePos(p: any): any {
    const { min, median, max } = PRICE_EX;
    p = Number(p);
    if (!p)
      return {
        txt: "내 아메리카노 가격을 넣으면 주변과 비교해 줘요.",
        pct: null,
        lvl: "",
      };
    const pct: any = Math.max(
        0,
        Math.min(100, ((p - min) / (max - min)) * 100),
      ),
      d: any = p - median,
      lvl: any = p < 3500 ? "저가 구간" : p <= 5500 ? "중간 구간" : "고가 구간";
    return {
      pct,
      lvl,
      txt:
        "중앙값 " +
        won(median) +
        "보다 " +
        (d === 0
          ? "같아요"
          : won(Math.abs(d)) + (d > 0 ? " 높아요" : " 낮아요")) +
        " · " +
        lvl,
    };
  }
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

  /* ---------- AI 상담: 서버 상담 API를 붙이기 전까지 비활성 (열면 준비 중 안내만 보인다) ---------- */
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
  /* ---------- 계정 · 마이페이지 · 다음 할 일 ---------- */
  const profile: any = () => take("profile", { name: "", provider: "" });
  function login(uid: any, name: any, provider: any): any {
    cancelPending();
    userId = uid;
    storage.set("foundy-session", JSON.stringify({ uid, name, provider }));
    if (!take("profile", null))
      put("profile", { name, provider, joined: iso(realToday()) });
    loadState();
    enter();
  }
  function enter(): any {
    if (!store.onboarded) {
      onboarding = { step: "choose", path: null, done: [], timers: [] };
      prepareRegistration();
      navigateTo("register");
      browserWindow.scrollTo(0, 0);
      return;
    }
    recalc();
    navigateTo("dashboard");
    browserWindow.scrollTo(0, 0);
  }
  function logout(): any {
    void logoutServer();
    cancelPending();
    clearTimers();
    storage.del("foundy-session");
    userId = null;
    profileDraft = null;
    chatOpen = false;
    toast("로그아웃했어요");
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
  let profileDraft: any = null;
  const {
    mpDraft: getProfileDraft,
    mpDiff: getProfileChanges,
    mpImpacts: getProfileImpacts,
    resetList,
    mpValidate,
  } = createProfileSelectors({
    eff: effectiveStore,
    get S() {
      return store;
    },
    get MP() {
      return profileDraft;
    },
    set MP(value) {
      profileDraft = value;
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
    k === "birth" || k === "funds" || k === "area"
      ? (k === "funds" || k === "area") && (v == null || String(v).trim() === "")
        ? null
        : num(v)
      : k === "alcohol" || k === "terrace" || k === "employees" || k === "delivery"
        ? !!v
        : String(v == null ? "" : v).trim();
  const formatProfileValue: any = (k: any, v: any) =>
    k === "alcohol" || k === "terrace" || k === "employees" || k === "delivery"
      ? v
        ? "네"
        : "아니요"
      : k === "location"
        ? v === "decided"
          ? "자리 확정"
          : "자리 미정"
        : k === "area"
          ? v == null || String(v).trim() === ""
            ? "(없음)"
            : `${v}㎡`
          : k === "funds"
          ? v == null || String(v).trim() === ""
            ? "(없음)"
            : won(v)
          : String(v == null ? "" : v).trim() || "(비어 있음)";
  const { applyMp, wipeStore } = createProfileWorkflow({
    get modalState() {
      return modalState;
    },
    modal,
    setTimeout,
    mpDraft: getProfileDraft,
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
    get MP() {
      return profileDraft;
    },
    set MP(value) {
      profileDraft = value;
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
  const passwordAuth = createPasswordAuth({
    $: findElement,
    login,
    toast,
    notify,
  });
  listen("submit", (e: any) => {
    if (e.target.id === "nxForm") {
      e.preventDefault();
      readForm();
      onboarding.step = 2;
      prepareRegistration();
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
      toast("후보를 추가했어요 · 건물 용도와 상권 지표는 예시값이에요");
    }
  });
  listen("change", (e: any) => {
    const m: any = e.target;
    if (m.dataset && m.dataset.mp) {
      getProfileDraft()[m.dataset.mp] = m.value;
      return;
    }
    const b: any = e.target.closest("[data-nx]");
    if (!b) return;
    if (b.dataset.nx === "gsort") {
      grantFilters.sort = b.value;
    }
  });
  const actionHandlers = {
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
      get RS() {
        return reportStates;
      },
      put,
      logNext,
      syncLinks,
      toast,
      showNext,
      $: findElement,
      evidenceModal,
    }),
    ...createDocumentsActions({
      copyText,
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
    ...createAuthActions({
      modal,
      setTimeout,
      $: findElement,
      login,
      logout,
      toast,
      profile,
      put,
      LS: storage,
      get UID() {
        return userId;
      },
    }),
    ...createProfileActions({
      mpDraft: getProfileDraft,
      applyMp,
      get MP() {
        return profileDraft;
      },
      set MP(value) {
        profileDraft = value;
      },
      modal,
      wipeStore,
    }),
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
      setChatOpen: (open: boolean | "toggle") => {
        chatOpen = open === "toggle" ? !chatOpen : open;
      },
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
    if (t.dataset && t.dataset.mp) {
      getProfileDraft()[t.dataset.mp] = t.value;
      return;
    }
  });
  listen("submit", (e: any) => {
    if (e.target.id === "nxPwLogin") {
      e.preventDefault();
      void passwordAuth.login();
      return;
    }
    if (e.target.id === "nxPwSignup") {
      e.preventDefault();
      void passwordAuth.signup();
      return;
    }
    if (e.target.id === "nxSocial") {
      e.preventDefault();
      const n: any = findElement("socialName").value.trim();
      if (!n) return;
      const p: any = e.target.dataset.p;
      closeModal();
      login(p + ":" + encodeURIComponent(n.toLowerCase()), n, p);
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
      const a: any = AREAS.find((x: any) => x.id === e.target.dataset.area);
      store.region =
        store.region.split(" ").slice(0, 2).join(" ") +
        " " +
        a.name.split(" ")[0];
      saveS();
      closeModal();
      onboarding.path = "decided";
      runAnalysis();
      navigateTo("register");
      toast("주소를 확정했어요 · 점검을 시작합니다");
    }
  });
  /* ---------- 초기화 ---------- */
  (function boot() {
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
      modal: modalState,
      toast: toastMessage,
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
        contactOfAgency,
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
      return { allTasks, dday, CONTACT };
    },
    grants: () => {
      return { GRANTS, G: grantFilters, RES, dday, GRANT_EXCLUDED };
    },
    sites: () => {
      return {
        S: store,
        MAP: market,
        SHOPS,
        EXFOOD,
        AREAS,
        PRICE: currentPrice,
        PRICE_EX,
        density,
        compLevel,
        mkStats,
        pricePos,
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
        STEPS_DECIDED,
      };
    },
    mypage: () => {
      return {
        S: store,
        mpDraft: getProfileDraft,
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
    logout: () => {
      logout();
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
    navigate: (p: string) => {
      if (!userId) {
        notify();
        return;
      }
      if (!store.onboarded) p = "register";
      if (pages[p]) navigateTo(p);
      notify();
    },
    closeModal: () => {
      closeModal();
      notify();
    },
    // API 연결 계층이 서버 데이터로 만든 확인 창·안내를 띄울 때 쓴다.
    showModal: (title: string, content: DialogContent) => {
      modal(title, content);
      notify();
    },
    showToast: (message: string) => {
      toast(message);
      notify();
    },
    // 서버에 저장된 가게로 로컬 가게 정보를 맞춘다 (다른 기기에서 등록했거나 마이페이지에서 수정한 값).
    adoptServerStore: (next: Store) => {
      store = { ...store, ...next, onboarded: true };
      profileDraft = null;
      saveS();
      recalc();
      calendar.y = null;
      if (userId && currentPage === "register") navigateTo("dashboard");
      notify();
    },
    // 서버 분석이 진행되는 동안 가게 등록 화면의 단계 표시를 서버 이벤트에 맞춘다 (가짜 타이머를 멈춘다).
    setAnalysisProgress: (done: number[]) => {
      clearTimers();
      onboarding.step = 3;
      onboarding.done = [...done];
      notify();
    },
    navigateTo: (page: string) => {
      if (pages[page]) navigateTo(page);
      notify();
    },
    destroy: lifecycle.destroy,
  };
}
