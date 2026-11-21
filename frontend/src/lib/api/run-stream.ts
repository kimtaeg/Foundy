/** 분석 실행(run)의 진행을 SSE로 따라간다. 스트림이 끊기면 상태 조회로 마무리한다. */
import { apiFetch } from "@/lib/api/client";
import { readEventStream } from "@/lib/api/sse";

const POLL_MS = 1500;
const POLL_LIMIT = 120;

export type StepHandler = (step: string, status: string) => void;

async function pollUntilDone(runId: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt += 1) {
    const run = await apiFetch<{ status: string; error?: string | null }>(`/api/runs/${runId}`, { token });
    if (run.status === "done") return;
    if (run.status === "failed") throw new Error(run.error ?? "분석에 실패했어요");
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error("분석이 오래 걸려요");
}

/** 끝나면 resolve, 분석이 실패하면 throw. */
export async function followRun(runId: string, token: string, onStep: StepHandler): Promise<void> {
  let failure: string | null = null;
  let finished = false;
  try {
    await readEventStream(`/api/runs/${runId}/stream`, token, (event, data) => {
      if (event === "step") {
        const { step, status } = data as { step: string; status: string };
        onStep(step, status);
      } else if (event === "done") finished = true;
      else if (event === "error") failure = (data as { message?: string }).message ?? "분석에 실패했어요";
    });
  } catch {
    await pollUntilDone(runId, token);
    finished = true;
  }
  if (failure) throw new Error(failure);
  if (!finished) await pollUntilDone(runId, token);
}

/** 서버 분석 단계 → 가게 등록 화면의 9단계 번호 (data/onboarding.ts STEPS_DECIDED 순서) */
const STEP_INDEX: Record<string, number> = {
  address: 0,
  building: 1,
  trademark: 2,
  law: 3,
  rules: 4,
  interpret: 5,
  advise: 6,
  checklist: 7,
  grants: 8,
  market: 8,
};
const FINISHED = new Set(["done", "fallback", "skipped", "failed"]);
export const ANALYSIS_STEP_COUNT = 9;

/** 단계 이벤트에서 끝난 화면 단계 번호들을 돌려준다. 이벤트가 없는 앞 단계(주소 조회 생략 등)는 뒤 단계가 시작되면 끝난 것으로 본다. */
export function finishedIndexes(step: string, status: string): number[] {
  const index = STEP_INDEX[step];
  if (index === undefined) return [];
  const indexes = Array.from({ length: index }, (_, i) => i);
  if (FINISHED.has(status)) indexes.push(index);
  return indexes;
}
