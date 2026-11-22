import { apiEnabled } from "@/lib/api/client";
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

export function focusNavigationItem(destination: string, id: string) {
  if (!id) return;
  const key = CSS.escape(id);
  const selector = destination === "report" ? `#result-${key}`
    : destination === "checklist" ? `[data-checklist-task="${key}"]` : null;
  if (!selector) return;

  const focus = () => {
    const row = document.querySelector(selector);
    if (!row) return false;
    if (row instanceof HTMLDetailsElement) row.open = true;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    return true;
  };
  if (focus()) return;
  const observer = new MutationObserver(() => { if (focus()) observer.disconnect(); });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 5000);
}

export function resolveApplicationPage(
  snapshot: Pick<FoundySnapshot, "uid" | "onboarded">,
  requested: string,
): ApplicationPage {
  if (!snapshot.uid) return "login";
  if (!snapshot.onboarded) {
    if (!apiEnabled() || requested === "register") return "register";
    return "mypage";
  }
  if (requested === "register" && apiEnabled()) return "dashboard";
  return isFeaturePage(requested) ? requested : "dashboard";
}
