import { type GrantMonth } from "@/types/grant-view";
import { type Grant, type GrantFilters } from "@/types/grants";

export function selectGrants(grants: Grant[], filters: GrantFilters): Grant[] {
  const result = grants.filter(
    (grant) =>
      (filters.res === "all" || grant.res === filters.res) &&
      (filters.cat === "all" || grant.cat === filters.cat),
  );
  return result.sort((a, b) =>
    filters.sort === "deadline"
      ? (a.deadline || "9999") < (b.deadline || "9999")
        ? -1
        : 1
      : ["eligible", "partial", "unknown"].indexOf(a.res) -
        ["eligible", "partial", "unknown"].indexOf(b.res),
  );
}
export function groupGrantsByMonth(grants: Grant[]): GrantMonth[] {
  const grouped: Record<string, Grant[]> = {};
  for (const grant of grants) {
    if (!grant.deadline) continue;
    const month = grant.deadline.slice(0, 7);
    (grouped[month] ??= []).push(grant);
  }
  return Object.keys(grouped)
    .sort()
    .map((month) => ({ month, grants: grouped[month] }));
}
