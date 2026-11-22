import { apiEnabled } from "@/lib/api/client";
import { createAccountApi, createStoreApi, getApiIdentity, loadSession, rememberApiIdentity, saveSession, type ApiSession } from "@/lib/api/foundy-api";
import { finishedIndexes, followRun, stepNote } from "@/lib/api/run-stream";
import type { ApiSetup } from "@/lib/api/types";
import { STEPS_DECIDED } from "@/data/onboarding";
import type { OnboardingAnswers } from "@/types/onboarding";
import type { Store } from "@/types/store";

export const SERVER_STEPS: string[] = STEPS_DECIDED.slice(0, 8);

interface RegistrationControls {
  currentStore(): Store;
  answers(): OnboardingAnswers;
  persist(): void;
  active(token: string): boolean;
  saving(value: boolean): void;
  progress(done: number[], notes: Record<number, string>, finished: boolean): void;
  questions(): void;
  toast(message: string): void;
  finish(): void;
  preview(): Promise<void>;
}

function profileFields(store: Store) {
  return {
    name: store.name,
    business_type_input: store.type,
    address: store.address,
    address_detail: store.detail,
    opening_date: store.opening,
    owner_birth_year: store.birth,
    area_sqm: store.area,
  };
}

export function createServerOnboarding(controls: RegistrationControls) {
  let activeToken: string | null = null;
  let savedProfile: { token: string; fields: ReturnType<typeof profileFields> } | null = null;

  function rememberProfile(token: string) {
    savedProfile = { token, fields: profileFields(controls.currentStore()) };
  }

  function rememberSetup(token: string, setup: ApiSetup, storeId?: string) {
    const identity = getApiIdentity(token);
    if (!identity) return;
    const store = controls.currentStore();
    rememberApiIdentity(token, {
      ...identity, setup, store_id: storeId ?? identity.store_id, store_name: store.name, store_opening: store.opening,
    });
  }

  async function saveProfile() {
    const session = loadSession();
    if (!session) {
      controls.toast("로그인이 만료됐어요. 다시 로그인해 주세요.");
      return;
    }
    if (activeToken === session.token) return;
    activeToken = session.token;
    controls.saving(true);
    const profile = profileFields(controls.currentStore());
    try {
      if (session.storeId) {
        const before = savedProfile?.token === session.token ? savedProfile.fields : null;
        const patch = Object.fromEntries(Object.entries(profile).filter(([key, value]) => value !== before?.[key as keyof typeof profile]));
        if (Object.keys(patch).length) {
          const { setup } = await createStoreApi(session).patchStore(patch);
          if (!controls.active(session.token)) return;
          rememberSetup(session.token, setup, session.storeId);
        }
      } else {
        const { owner_birth_year, area_sqm, ...required } = profile;
        const { store_id, setup } = await createAccountApi(session).registerStore({
          ...required, fixed_questions: true, ...(owner_birth_year !== null ? { owner_birth_year } : {}),
          ...(area_sqm !== null ? { area_sqm } : {}),
        });
        if (!controls.active(session.token)) return;
        rememberSetup(session.token, setup, store_id);
        saveSession({ ...session, storeId: store_id });
      }
      if (controls.active(session.token)) {
        rememberProfile(session.token);
        controls.questions();
      }
    } catch (error) {
      if (controls.active(session.token)) controls.toast(error instanceof Error ? error.message : "가게 정보를 저장하지 못했어요.");
    } finally {
      if (activeToken === session.token) activeToken = null;
      if (controls.active(session.token)) controls.saving(false);
    }
  }

  async function analyze(session: ApiSession, runId?: string) {
    const { token, storeId } = session;
    if (!storeId || activeToken === token) return;
    const { alcohol, terrace, employees } = controls.answers();
    if (!runId && (alcohol === null || terrace === null || employees === null)) {
      controls.toast("영업 조건 세 가지를 모두 선택해 주세요.");
      return;
    }
    activeToken = token;
    const current = () => controls.active(token);
    try {
      controls.progress([], {}, false);
      if (!runId) {
        const api = createStoreApi(session);
        const { setup } = await api.saveAnswers({
          sells_alcohol: alcohol, uses_terrace: terrace, has_employees: employees,
          funds_krw: controls.currentStore().funds,
        });
        if (!current()) return;
        rememberSetup(token, setup, storeId);
        ({ run_id: runId } = await api.analyze());
        if (!current()) return;
      }
      const done = new Set<number>();
      const notes: Record<number, string> = {};
      await followRun(runId, token, (step, status, message) => {
        if (!current()) return;
        finishedIndexes(step, status).filter(i => i < SERVER_STEPS.length).forEach(i => done.add(i));
        const note = stepNote(step, status, message);
        if (note) notes[note.index] = note.note;
        controls.progress([...done], notes, false);
      });
      if (current()) controls.progress(SERVER_STEPS.map((_, i) => i), notes, true);
    } catch (error) {
      if (!current()) return;
      controls.questions();
      controls.toast(error instanceof Error ? error.message : "점검을 다시 시도해 주세요.");
    } finally {
      if (activeToken === token) activeToken = null;
    }
  }

  return {
    rememberProfile,
    saveProfile,
    resume(session: ApiSession, runId: string) {
      void analyze(session, runId);
    },
    click(command: string | undefined, step: number, finished: boolean) {
      if (!apiEnabled()) return false;
      const session = loadSession();
      if (!session) {
        if (command !== "demo" && command !== "analyze" && command !== "finish") return false;
        controls.toast("로그인이 만료됐어요. 다시 로그인해 주세요.");
        return true;
      }
      if (command === "demo") {
        if (activeToken !== session.token) {
          activeToken = session.token;
          void controls.preview()
            .catch(() => controls.toast("미리보기 계정을 열지 못했어요."))
            .finally(() => { if (activeToken === session.token) activeToken = null; });
        }
        return true;
      }
      if (command === "analyze" && step === 2) {
        const input = document.getElementById("fFunds") as HTMLInputElement | null;
        if (input && !input.reportValidity()) return true;
        if (input) controls.currentStore().funds = input.value === "" ? null : Number(input.value);
        controls.persist();
        void analyze(session);
        return true;
      }
      if (command === "finish") {
        if (finished) controls.finish();
        return true;
      }
      return false;
    },
  };
}
