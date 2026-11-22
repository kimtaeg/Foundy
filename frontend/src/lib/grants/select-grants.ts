import { type Grant, type GrantFilters } from "@/types/grants";

export function selectGrants(grants: Grant[], filters: GrantFilters): Grant[] {
  const result = grants.filter(
    (grant) =>
      (filters.res === "all" || grant.res === filters.res) &&
      (filters.cat === "all" || grant.cat === filters.cat),
  );
  return result.sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
}

export function selectGrantOverview(catalog: Grant[], filters: GrantFilters, asOf: string) {
  const counts = { eligible: 0, partial: 0, unknown: 0 };
  let nextDeadline: Grant | null = null;
  for (const grant of catalog) {
    if (filters.cat !== "all" && grant.cat !== filters.cat) continue;
    counts[grant.res]++;
    if (filters.res !== "all" && grant.res !== filters.res) continue;
    if (grant.deadline && grant.deadline >= asOf && (!nextDeadline?.deadline || grant.deadline < nextDeadline.deadline)) {
      nextDeadline = grant;
    }
  }
  return { counts, nextDeadline };
}
