import { type FoundySnapshot } from "@/types/foundy";
import type { ApplicationPage, FeaturePage } from "@/types/routes";

export const featurePages = [
  "dashboard",
  "report",
  "checklist",
  "docs",
  "grants",
  "sites",
  "mypage",
  "register",
] as const;

export function isFeaturePage(page: string): page is FeaturePage {
  return featurePages.some((candidate) => candidate === page);
}

export function resolveApplicationPage(
  snapshot: Pick<FoundySnapshot, "uid" | "onboarded">,
  requested: string,
): ApplicationPage {
  if (!snapshot.uid) return "login";
  if (!snapshot.onboarded) return "register";
  return isFeaturePage(requested) ? requested : "dashboard";
}
