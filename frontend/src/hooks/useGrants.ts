"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { groupGrantsByMonth, selectGrants } from "@/lib/grants/select-grants";
import type { GrantsViewData, GrantViewItem } from "@/types/grant-view";
import type { Grant } from "@/types/grants";

export function useGrants(): GrantsViewData | null {
  const { context } = useFeatureData("grants");
  if (!context) return null;
  const grants = selectGrants(context.GRANTS, context.G);
  const present = (grant: Grant): GrantViewItem => ({
    grant,
    label: context.RES[grant.res][0],
    tone: context.RES[grant.res][1],
    deadline: grant.deadline ? context.dday(grant.deadline) : "일정 미정",
  });
  return {
    filters: context.G,
    grants: grants.map(present),
    months: groupGrantsByMonth(grants).map((group) => ({
      month: group.month,
      grants: group.grants.map(present),
    })),
    categories: ["all", ...new Set(context.GRANTS.map((grant) => grant.cat))],
    excludedCount: context.GRANT_EXCLUDED,
    status: context.GRANT_STATUS ?? null,
  };
}
