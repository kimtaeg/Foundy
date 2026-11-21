"use client";
/** 예시 계정 화면을 백엔드 API에 연결한다.
 *
 * - 로컬 엔진에서 예시 계정(uid "demo")으로 들어오면 POST /api/demo 로 서버 계정을 만들고 토큰을 저장한다.
 * - 대시보드·리포트·체크리스트·서류함·알림 데이터는 서버 응답으로 그린다.
 * - 카드 선택·진행 상태·체크·알림 읽음은 서버에 저장한 뒤 응답을 다시 받는다.
 * - 서버에 연결하지 못하면 로컬 예시 데이터로 계속 동작한다 ("예시로 해보기"는 끝까지 돌아가야 한다).
 * - 아이디·비밀번호 계정(uid "local:…")은 저장된 서버 세션으로 같은 화면을 그린다.
 *   가게가 아직 없으면 가게 등록·되묻기·분석(SSE)을 서버로 처리하고, 마이페이지 수정은 PATCH 로 저장한다.
 */
import { ApiError, apiEnabled } from "@/lib/api/client";
import type { ApiDocumentStatus } from "@/lib/api/types";
import { ANALYSIS_STEP_COUNT, finishedIndexes, followRun } from "@/lib/api/run-stream";
import { createApiModel, toEvidence, type ApiModel } from "@/lib/api/contexts";
import { useServerProfile } from "@/hooks/useServerProfile";
import {
  clearSession,
  createAccountApi,
  createStoreApi,
  loadSession,
  saveSession,
  startDemoSession,
  type ApiSession,
} from "@/lib/api/foundy-api";
import { optionMeta } from "@/lib/report/option-meta";
import { iso, realToday } from "@/lib/date";
import { type FoundyStore } from "@/types/foundy";
import { useCallback, useEffect, useRef, useState } from "react";

const RUN_POLL_MS = 1500;
const RUN_POLL_LIMIT = 120;

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const candidates = error.details?.candidates;
    if (error.code === "ADDRESS_NOT_RESOLVED" && Array.isArray(candidates) && candidates.length)
      return `${error.message} (후보: ${candidates.slice(0, 3).join(" / ")})`;
    if (error.code === "RUN_IN_PROGRESS") return "분석이 진행 중이에요 · 끝난 뒤 다시 시도해 주세요";
    return error.message;
  }
  return "요청을 처리하지 못했어요";
}

const isAccountUid = (uid: string | null) => !!uid && uid.startsWith("local:");

export function useApiBridge(engine: FoundyStore | null, uid: string | null) {
  const [model, setModel] = useState<ApiModel | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sessionRef = useRef<ApiSession | null>(null);
  const starting = useRef(false);
  /** 세션 준비를 시작·취소할 때마다 늘린다. 늦게 끝난 옛 준비 작업이 새 세션 상태를 덮어쓰지 않게 한다. */
  const generation = useRef(0);

  const [loading, setLoading] = useState(false);
  const account = isAccountUid(uid);
  const active = apiEnabled() && (uid === "demo" || account) && !failed;

  /** 서버 응답을 다시 받아 화면 모델을 바꾼다. 받은 모델을 돌려주고, 연결할 수 없으면 null. */
  const refresh = useCallback(async (): Promise<ApiModel | null> => {
    const session = sessionRef.current;
    if (!session?.storeId) return null;
    // 응답을 기다리는 사이 로그아웃·계정 전환으로 세션이 바뀌었으면, 옛 세션의 응답(성공·401 모두)은 버린다.
    // 버리지 않으면 폐기된 토큰의 401 이 새로 들어온 계정(예: 예시 계정)까지 로그아웃시킨다.
    const stale = () => sessionRef.current !== session;
    try {
      const next = createApiModel(await createStoreApi(session).loadBundle());
      if (stale()) return null;
      setModel(next);
      return next;
    } catch (error) {
      if (stale()) return null;
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        sessionRef.current = null;
        starting.current = false;
        setModel(null);
        if (session.kind === "account") {
          // 일반 계정의 토큰이 만료됐다: 로그아웃하고 다시 로그인하게 한다.
          engine?.showToast("로그인이 만료됐어요. 다시 로그인해 주세요");
          engine?.logout();
        } else {
          // 예시 계정: 새로 만든다.
          clearSession();
          setAttempt((n) => n + 1);
        }
        return null;
      }
      setFailed(true);
      engine?.showToast("서버에 연결하지 못해 예시 데이터로 보여 드려요");
      return null;
    }
  }, [engine]);

  // 서버 세션을 준비하고(예시 계정은 만들고, 일반 계정은 로그인 때 저장한 것을 읽고), 나가면 지운다.
  useEffect(() => {
    if (!apiEnabled() || !engine) return;
    if (uid !== "demo" && !account) {
      if (uid === null) clearSession();
      generation.current += 1;
      sessionRef.current = null;
      starting.current = false;
      setModel(null);
      setFailed(false);
      setLoading(false);
      return;
    }
    if (failed || sessionRef.current || starting.current) return;
    if (attempt > 2) {
      setFailed(true);
      return;
    }
    starting.current = true;
    const gen = ++generation.current;
    const current = () => gen === generation.current;
    void (async () => {
      try {
        if (account) {
          const saved = loadSession("account");
          if (!saved) {
            // 이 브라우저에 서버 세션이 없다(저장소 삭제 등): 다시 로그인하게 한다.
            engine.showToast("로그인 정보가 없어요. 다시 로그인해 주세요");
            engine.logout();
            return;
          }
          sessionRef.current = saved;
          if (!saved.storeId) return; // 가게 등록 전: 등록 화면은 서버 호출 없이 시작한다
          setLoading(true);
        } else {
          const demo = loadSession("demo") ?? (await startDemoSession());
          if (!current()) return; // 기다리는 사이 로그아웃됐다
          sessionRef.current = demo;
        }
        const loaded = await refresh();
        // 다른 기기·이전 방문에서 등록한 가게: 로컬 가게 정보를 서버 값으로 맞춘다.
        if (loaded && account && current()) engine.adoptServerStore(loaded.S);
      } catch {
        if (!current()) return;
        setFailed(true);
        engine.showToast("서버에 연결하지 못해 예시 데이터로 보여 드려요");
      } finally {
        if (current()) {
          setLoading(false);
          starting.current = false;
        }
      }
    })();
  }, [engine, uid, account, failed, attempt, refresh]);

  const waitForRun = useCallback(
    async (runId: string) => {
      const session = sessionRef.current;
      if (!session) return;
      const api = createStoreApi(session);
      for (let i = 0; i < RUN_POLL_LIMIT; i++) {
        await new Promise((resolve) => setTimeout(resolve, RUN_POLL_MS));
        const run = await api.runStatus(runId).catch(() => null);
        if (run && run.status !== "queued" && run.status !== "running") {
          await refresh();
          engine?.showToast(run.status === "done" ? "다시 점검한 결과를 반영했어요" : "다시 점검하지 못했어요 · 잠시 후 다시 시도해 주세요");
          return;
        }
      }
    },
    [engine, refresh],
  );

  const run = useCallback(
    async (work: (api: ReturnType<typeof createStoreApi>) => Promise<string | void>) => {
      const session = sessionRef.current;
      if (!session) return;
      engine?.showToast("저장하는 중이에요…");
      try {
        const message = await work(createStoreApi(session));
        await refresh();
        if (message) engine?.showToast(message);
      } catch (error) {
        engine?.showToast(errorMessage(error));
      }
    },
    [engine, refresh],
  );

  const choose = useCallback(
    (itemId: string, optionId: string) =>
      run(async (api) => {
        const result = await api.choose(itemId, optionId);
        if (result.run_id) void waitForRun(result.run_id);
        const label = model?.cards.find((c) => c.id === itemId)?.options.find((o) => o.id === optionId)?.label;
        return result.run_id
          ? `“${label ?? "선택"}” 적용 · 바뀐 조건으로 다시 점검하는 중이에요`
          : `“${label ?? "선택"}” 적용 · 변경 내용을 카드에서 확인하세요`;
      }),
    [model, run, waitForRun],
  );

  /** 가게가 없는 일반 계정의 가게 등록·분석. 서버로 처리했으면 true, 로컬 흐름에 맡기면 false. */
  const handleOnboarding = (type: string, event: { target: EventTarget; preventDefault(): void }): boolean => {
      const session = sessionRef.current;
      if (!engine || !session || session.kind !== "account") return false;
      const target = event.target as HTMLElement;

      if (type === "submit" && target.id === "nxForm") {
        if (session.storeId) return false; // 이미 등록했다 (뒤로 와서 다시 제출): 로컬 값만 갱신한다
        if (!document.getElementById("fAddr")) return false; // 자리 미정 경로는 서버가 지원하지 않는다
        event.preventDefault();
        const value = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
        const birth = Number(value("fBirth"));
        const area = Number(value("fArea"));
        void (async () => {
          try {
            const { store_id } = await createAccountApi(session).registerStore({
              name: value("fName").trim(),
              business_type_input: value("fType"),
              address: value("fAddr").trim(),
              address_detail: value("fDetail").trim(),
              opening_date: value("fOpen"),
              ...(birth ? { owner_birth_year: birth } : {}),
              ...(area > 0 ? { area_sqm: area } : {}),
            });
            const next: ApiSession = { ...session, storeId: store_id };
            sessionRef.current = next;
            saveSession(next);
            engine.handleEvent("submit", event); // 입력값을 로컬에 저장하고 추가 질문 단계로 넘어간다
          } catch (error) {
            engine.showToast(errorMessage(error));
          }
        })();
        return true;
      }

      const button = target.closest?.("[data-nx]") as HTMLElement | null;
      if (type === "click" && button?.dataset.nx === "analyze" && session.storeId) {
        void analyzeOnServer(session, button);
        return true;
      }
      return false;
  };

  const analyzeOnServer = async (session: ApiSession, source: EventTarget) => {
    if (!engine) return;
    const register = engine.getViewContext("register");
    const fundsInput = (document.getElementById("fFunds") as HTMLInputElement | null)?.value;
    const finished = new Set<number>();
    engine.setAnalysisProgress([]);
    try {
      const api = createStoreApi(session);
      await api.saveAnswers({
        sells_alcohol: register.S.alcohol,
        uses_terrace: register.S.terrace,
        does_delivery: register.S.delivery,
        has_employees: register.S.employees,
        funds_krw: fundsInput ? Number(fundsInput) : register.S.funds,
      });
      const { run_id } = await api.analyze();
      await followRun(run_id, session.token, (step, status) => {
        finishedIndexes(step, status).forEach((index) => finished.add(index));
        engine.setAnalysisProgress([...finished]);
      });
      // 결과를 받아 두고, "내 가게 홈으로" 버튼을 눌러 마치게 한다.
      if (!(await refresh())) throw new Error("결과를 불러오지 못했어요");
      engine.setAnalysisProgress(Array.from({ length: ANALYSIS_STEP_COUNT }, (_, index) => index));
    } catch (error) {
      engine.showToast(`${errorMessage(error)} · 예시 분석으로 이어가요`);
      engine.handleEvent("click", { target: source, preventDefault() {} }); // 로컬 분석으로 끝까지 진행
    }
  };

  // 마이페이지 가게 정보 수정: 서버 저장값으로 폼을 채우고, 서버 미리보기(dry_run)와 같은 본문으로 저장한다.
  const profile = useServerProfile({ engine, sessionRef, model: active ? model : null, refresh });

  /** 서류함의 상태 선택 (change 이벤트). 처리했으면 true. */
  const handleDocumentChange = (target: HTMLElement): boolean => {
    const statusId = target.dataset?.docStatus;
    if (!statusId || !(target instanceof HTMLSelectElement)) return false;
    const status = target.value as ApiDocumentStatus;
    void run(async (api) => {
      await api.setDocumentStatus(statusId, status);
      return "서류 상태를 바꿨어요";
    });
    return true;
  };

  /** 서버 데이터가 필요한 이벤트만 처리하고 true 를 돌려준다. 나머지(이동·필터·보기 전환)는 로컬 엔진이 처리한다. */
  const handleEvent = (type: string, event: { target: EventTarget; preventDefault(): void }): boolean => {
      if (active && !model && account && handleOnboarding(type, event)) return true;
      if (active && model && engine && profile.handleEvent(type, event)) return true;
      if (active && model && engine && type === "change" && handleDocumentChange(event.target as HTMLElement)) return true;
      if (!active || !model || !engine || type !== "click") return false;
      const target = event.target as HTMLElement;
      const taskRow = target.closest?.("[data-task]") as HTMLElement | null;
      const button = target.closest?.("[data-nx]") as HTMLElement | null;

      if (taskRow && !button) {
        const id = taskRow.dataset.task ?? "";
        const task = model.allTasks().find((t) => t.id === id);
        if (!task) return true;
        void run(async (api) => {
          await api.setTaskDone(id, !task.done);
          return task.done ? "체크를 해제했어요" : "완료로 체크했어요";
        });
        return true;
      }
      if (!button) return false;
      const id = button.dataset.id ?? "";
      const card = model.cards.find((c) => c.id === id);
      switch (button.dataset.nx) {
        case "opt": {
          const option = card?.options.find((o) => o.id === button.dataset.o);
          if (!card || !option) return true;
          engine.showModal("선택지 적용 확인", {
            kind: "option-confirm",
            cardId: card.id,
            optionId: option.id,
            label: option.label,
            summary: option.summary,
            changes: option.fx.changes,
            recommended: card.rec?.id === option.id,
            reason: card.rec?.id === option.id ? card.rec.reason : undefined,
            meta: optionMeta(option),
          });
          return true;
        }
        case "confirm":
          engine.closeModal();
          void choose(id, button.dataset.o ?? "");
          return true;
        case "rec":
          if (card?.rec) void choose(id, card.rec.id);
          return true;
        case "undo":
          engine.showToast("선택을 바꾸려면 다른 선택지를 골라 주세요");
          return true;
        case "act":
          void run(async (api) => {
            await api.action(id, "sent");
            return "문의 기록 완료 · 먼저 할 일을 정리했어요";
          });
          return true;
        case "actdone": {
          const memo = document.getElementById(`memo-${id}`) as HTMLTextAreaElement | null;
          void run(async (api) => {
            const result = await api.action(id, "done", memo?.value.trim() || undefined);
            const auto = result.auto_checked
              .map((taskId) => model.allTasks().find((t) => t.id === taskId)?.task)
              .filter(Boolean);
            return (
              "완료! 다음으로 할 일을 정리했어요" +
              (auto.length ? ` · 체크리스트 “${auto[0]}”${auto.length > 1 ? ` 외 ${auto.length - 1}개` : ""}도 자동 체크` : "")
            );
          });
          return true;
        }
        case "actreset":
          void run(async (api) => {
            await api.action(id, "pending");
          });
          return true;
        case "evid":
        case "cevid": {
          const item = model.byId.get(id);
          if (!item) return true;
          engine.showModal("판정 근거", {
            kind: "evidence",
            items: item.evidence.map(toEvidence),
            date: iso(realToday()),
          });
          return true;
        }
        case "docack":
          void run(async (api) => {
            await api.ackDocumentReview(button.dataset.did ?? "");
            return "다시 확인했어요";
          });
          return true;
        case "taskack":
          void run(async (api) => {
            await api.ackTaskReview(button.dataset.tid ?? "");
            return "다시 확인했어요";
          });
          return true;
        case "mpwipe":
          engine.showToast("서버에 저장된 가게는 처음부터 다시 설정할 수 없어요. 정보는 수정으로 바꿔 주세요");
          return true;
        default:
          return false;
      }
    };

  const openNotification = useCallback(
    (id: string): boolean => {
      if (!active || !model || !engine) return false;
      const alert = model.notifications.find((n) => n.id === id);
      if (!alert) return true;
      void run(async (api) => {
        if (!alert.read) await api.readAlert(id);
      });
      engine.navigateTo(alert.destination);
      if (alert.focus)
        setTimeout(
          () => document.getElementById(`result-${alert.focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
          60,
        );
      return true;
    },
    [active, model, engine, run],
  );

  return {
    /** 서버 데이터로 화면을 그리는 중이면 모델, 아니면 null (로컬 예시 데이터 사용) */
    model: active ? model : null,
    /** 서버 데이터를 기다리는 중 (화면은 로딩 표시) */
    pending: active && !model && (uid === "demo" || loading),
    handleEvent,
    openNotification,
    /** 서버 연결 모드면 마이페이지 화면 모델을 서버 미리보기 기준으로 바꾼다 (아니면 null → 로컬 데모 계산) */
    profileView: active && model && profile.active ? profile.view : null,
  };
}
