"use client";
/** 서버 연결 모드의 마이페이지 가게 정보 수정.
 *
 * - 폼 기준값은 GET /api/stores/{id} 의 저장값(loadBundle 의 store)이다. 사용자가 바꾼 값만 edits 로 둔다.
 * - 바뀐 필드만 담은 본문으로 PATCH ?dry_run=true 를 부르고, 서버 응답(영향 범위·초기화 카드)을 그대로 보여 준다.
 *   입력이 바뀌면 이전 미리보기를 무효화하고, 늦게 온 이전 응답은 버린다. 최신 입력의 미리보기가 성공했을 때만 저장할 수 있다.
 * - 저장은 미리보기와 같은 본문으로 보낸다. 409 는 입력을 유지하고, 미리보기 실패·저장 실패·저장 후 재분석 실패를 구분해 알린다.
 * - 알려진 한계: 미리보기 이후 다른 탭에서 카드 선택·가게 정보가 바뀌는 경우는 감지하지 않는다.
 */
import { IMP } from "@/data/store";
import { ApiError } from "@/lib/api/client";
import type { ApiModel } from "@/lib/api/contexts";
import { createStoreApi, type ApiSession } from "@/lib/api/foundy-api";
import { followRun } from "@/lib/api/run-stream";
import {
  buildStorePatch,
  effectiveNotes,
  formFromStore,
  patchKey,
  previewLines,
  type ServerForm,
  type ServerFormKey,
} from "@/lib/api/store-update";
import type { ApiPatchResult } from "@/lib/api/types";
import type { FoundyStore } from "@/types/foundy";
import type { ProfileViewModel, ServerPreview, StoreDraft } from "@/types/profile";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

const PREVIEW_DELAY_MS = 300;

/** 화면 입력(data-mp) 이름 → 폼 키. 서버가 모르는 관심 지역·자리 상태는 다루지 않는다. */
const MP_KEYS: Record<string, ServerFormKey> = {
  name: "name", type: "type", address: "address", detail: "detail", opening: "opening",
  birth: "birth", area: "area", funds: "funds",
};
const YN_KEYS: Record<string, ServerFormKey> = {
  alcohol: "alcohol", terrace: "terrace", employees: "employees", delivery: "delivery",
};

interface PreviewState {
  status: ServerPreview["status"];
  key: string;
  payload: Record<string, unknown> | null;
  result?: ApiPatchResult;
  error?: string;
}

const IDLE: PreviewState = { status: "idle", key: "", payload: null };

function describe(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return "서버에 연결하지 못했어요";
}

interface Options {
  engine: FoundyStore | null;
  sessionRef: MutableRefObject<ApiSession | null>;
  model: ApiModel | null;
  refresh: () => Promise<ApiModel | null>;
}

export function useServerProfile({ engine, sessionRef, model, refresh }: Options) {
  const store = model?.bundle.store ?? null;
  const base = useMemo(() => (store ? formFromStore(store) : null), [store]);
  const [edits, setEdits] = useState<Partial<ServerForm>>({});
  const [preview, setPreview] = useState<PreviewState>(IDLE);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);
  const latestKey = useRef("");

  const draft = useMemo(() => (base ? { ...base, ...edits } : null), [base, edits]);
  const patch = useMemo(() => (base && draft ? buildStorePatch(base, draft) : {}), [base, draft]);
  const key = useMemo(() => patchKey(patch), [patch]);
  const empty = Object.keys(patch).length === 0;

  // 입력이 바뀔 때마다 이전 미리보기를 무효화하고, 잠시 뒤 같은 본문으로 dry_run 을 부른다.
  useEffect(() => {
    latestKey.current = key;
    const id = ++seq.current;
    if (!store || empty) {
      setPreview(IDLE);
      return;
    }
    setPreview({ status: "loading", key, payload: patch });
    const timer = setTimeout(async () => {
      const session = sessionRef.current;
      if (!session?.storeId) return;
      try {
        const result = await createStoreApi(session).patchStore(patch, true);
        if (id !== seq.current || key !== latestKey.current) return; // 늦게 온 이전 응답은 버린다
        setPreview({ status: "ready", key, payload: patch, result });
      } catch (error) {
        if (id !== seq.current || key !== latestKey.current) return;
        setPreview({ status: "error", key, payload: patch, error: describe(error) });
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
    // patch 는 key 로 비교한다 (같은 내용이면 다시 부르지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, store, sessionRef]);

  const setField = useCallback(
    (field: ServerFormKey, value: string | boolean) => setEdits((prev) => ({ ...prev, [field]: value })),
    [],
  );

  const reset = useCallback(() => setEdits({}), []);

  const canSave = !saving && preview.status === "ready" && preview.key === key && !!preview.payload;

  const save = useCallback(async () => {
    const session = sessionRef.current;
    if (!engine || !session?.storeId || !canSave || !preview.payload || !preview.result) return;
    const payload = preview.payload; // 사용자가 확인한 미리보기와 같은 본문
    const sent = { ...edits }; // 저장을 시작할 때의 입력. 저장 중에 새로 바꾼 값은 저장 뒤에도 남긴다
    const api = createStoreApi(session);
    setSaving(true);
    engine.showToast("저장하는 중이에요…");
    let result: ApiPatchResult;
    try {
      result = await api.patchStore(payload);
    } catch (error) {
      setSaving(false);
      if (error instanceof ApiError && error.code === "RUN_IN_PROGRESS")
        engine.showToast("분석이 진행 중이에요 · 끝난 뒤 다시 시도해 주세요 (입력은 그대로 두었어요)");
      else engine.showToast(`저장하지 못했어요 · ${describe(error)} (입력은 그대로 두었어요)`);
      return;
    }
    // 저장은 끝났다. 이후 실패는 '저장됨, 재분석 실패' 로 구분한다
    const title = "변경 내용을 다시 반영하고 있어요";
    const steps = [...result.impacts.map((impact) => IMP[impact] ?? impact), "변경 요약 정리"];
    let lines = previewLines(result);
    const show = (completed: number) =>
      engine.showModal(title, { kind: "analysis-progress", steps, completed, changes: lines });
    let rerunFailed = false;
    if (result.run_id) {
      show(0);
      let finished = 0;
      try {
        await followRun(result.run_id, session.token, (_step, status) => {
          if (status === "done" || status === "fallback") {
            finished += 1;
            show(Math.min(steps.length - 1, finished));
          }
        });
      } catch {
        rerunFailed = true;
      }
    }
    const next = await refresh(); // 가게 정보(폼 기준값)·리포트·체크리스트를 서버에서 다시 읽는다
    try {
      const history = await api.changes(); // 변경 기록도 서버 값으로 다시 읽는다
      if (history.items[0]?.lines?.length) lines = history.items[0].lines;
    } catch {
      // 변경 기록을 못 읽어도 저장 결과는 응답으로 보여 준다
    }
    if (next) engine.adoptServerStore(next.S);
    setEdits((current) => {
      const rest = { ...current };
      for (const field of Object.keys(sent) as ServerFormKey[]) {
        if (rest[field] === sent[field]) delete rest[field]; // 저장한 값은 이제 기준값이다
      }
      return rest;
    });
    setSaving(false);
    if (result.run_id) {
      if (rerunFailed) engine.closeModal();
      else show(steps.length);
    }
    if (rerunFailed) engine.showToast("가게 정보는 저장했지만 다시 점검하지 못했어요 · 잠시 후 다시 분석해 주세요");
    else if (!next) engine.showToast("가게 정보는 저장했지만 새 결과를 불러오지 못했어요 · 새로고침해 주세요");
    else engine.showToast("가게 정보를 저장했어요");
  }, [engine, sessionRef, canSave, preview, refresh, edits]);

  /** 마이페이지 입력·버튼 이벤트. 처리했으면 true. */
  const handleEvent = (type: string, event: { target: EventTarget }): boolean => {
    if (!store) return false;
    const target = event.target as HTMLElement;
    if ((type === "input" || type === "change") && target.dataset?.mp) {
      const field = MP_KEYS[target.dataset.mp];
      if (!field) return false; // 관심 지역 등 서버가 모르는 항목
      setField(field, (target as HTMLInputElement).value);
      return true;
    }
    if (type !== "click") return false;
    const button = target.closest?.("[data-nx]") as HTMLElement | null;
    switch (button?.dataset.nx) {
      case "mpyn": {
        const field = YN_KEYS[button.dataset.k ?? ""];
        if (!field) return false;
        setField(field, button.dataset.v === "1");
        return true;
      }
      case "mpsave":
        if (canSave) void save();
        else if (saving) engine?.showToast("저장하는 중이에요…");
        else if (preview.status === "error") engine?.showToast("미리보기를 받지 못해 저장할 수 없어요 · 입력을 확인해 주세요");
        else engine?.showToast("바뀐 내용의 영향을 확인하는 중이에요 · 잠시 후 저장해 주세요");
        return true;
      case "mpreset":
        reset();
        return true;
      default:
        return false;
    }
  };

  /** 화면 모델 (로컬 데모 계산 대신 서버 미리보기를 쓴다). 기본 화면 정보는 로컬 컨텍스트에서 받는다. */
  const view = (local: ProfileViewModel): ProfileViewModel => {
    if (!draft || !store) return local;
    const d: StoreDraft = {
      ...local.draft,
      name: draft.name, type: draft.type, address: draft.address, detail: draft.detail, opening: draft.opening,
      birth: draft.birth, area: draft.area, funds: draft.funds, location: "decided", region: store.region ?? "",
      alcohol: !!draft.alcohol, terrace: !!draft.terrace, employees: !!draft.employees, delivery: !!draft.delivery,
    };
    const changed = (Object.keys(edits) as ServerFormKey[]).filter((k) => base && edits[k] !== undefined && edits[k] !== base[k]);
    const result = preview.status === "ready" && preview.key === key ? preview.result : undefined;
    return {
      ...local,
      onboarded: true,
      draft: d,
      changes: empty ? [] : changed.map((k) => ({ k: k as keyof StoreDraft, from: base?.[k] ?? "", to: draft[k] ?? "" })),
      affectedLabels: result ? result.impacts.map((impact) => IMP[impact] ?? impact) : [],
      resetCards: result
        ? result.reset_items.map((item) => ({ id: item.item_id, short: item.title, opt: item.chosen_label ?? "" }))
        : [],
      preview: {
        status: empty ? "idle" : preview.key === key ? preview.status : "loading",
        impacts: result ? result.impacts.map((impact) => IMP[impact] ?? impact) : [],
        // 초기화 카드는 ResetCardNotice 가 따로 보여 주므로 여기서는 바뀐 값 줄만 쓴다
        lines: result ? previewLines(result).slice(0, result.changed.length) : [],
        needsReanalyze: !!result?.needs_reanalyze,
        error: preview.status === "error" && preview.key === key ? preview.error : undefined,
        canSave,
        saving,
      },
      answered: { alcohol: draft.alcohol, terrace: draft.terrace, employees: draft.employees, delivery: draft.delivery },
      notes: effectiveNotes(store) as ProfileViewModel["notes"],
    };
  };

  return { active: !!store, handleEvent, view };
}
