import type { GrantStatus } from "@/types/grant-view";

/** 지원사업 화면 오른쪽 위 배지. 서버 연결이 없으면 예시 공고다. */
export function grantBadge(status: GrantStatus | null): { label: string; tone: string } {
  if (!status || status.example) return { label: "예시 공고 · 실제 아님", tone: "unknown" };
  if (status.state === "loading") return { label: "공고 불러오는 중", tone: "unknown" };
  if (status.state === "unavailable") return { label: "공고를 불러오지 못함", tone: "low" };
  return { label: `실제 공고 · ${status.source ?? "K-Startup"}`, tone: "ok" };
}

/** 목록 위에 보여 줄 안내 문구. 없으면 null */
export function grantNote(status: GrantStatus | null): string | null {
  if (!status) return null;
  if (status.state === "loading")
    return "모집 중인 공고를 불러와 내 가게와 대조하고 있어요. 수십 초 걸릴 수 있어요.";
  if (status.state === "unavailable")
    return "공고를 불러오지 못했어요. 잠시 후 다시 열어 주세요. 예시 공고는 실제 공고처럼 보여 주지 않아요.";
  if (status.state === "empty") return "아직 대조한 공고가 없어요.";
  return status.judgedAt ? `${status.judgedAt.slice(0, 10)}에 모집 중인 공고를 대조했어요.` : null;
}
