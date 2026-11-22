"use client";
import { useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { loadSession, sessionSnapshot } from "@/lib/api/foundy-api";
import { readGrants } from "@/lib/grants/read-grants";
import { refreshGrants } from "@/lib/grants/refresh-grants";
import { selectGrantOverview, selectGrants } from "@/lib/grants/select-grants";
import { iso, realToday } from "@/lib/date";
import type { GrantsViewData, GrantViewItem } from "@/types/grant-view";
import type { Grant } from "@/types/grants";

const refreshErrorMessage = "새 공고를 조회하지 못했어요. 잠시 후 다시 시도해 주세요.";

export function useGrants() {
  const { context, api, apiActive, apiError, refreshApi, updateApi, onEvent } = useFeatureData("grants");
  const response = api?.bundle.grants;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();
  const refreshingRef = useRef(false);

  async function refresh() {
    const sessionKey = sessionSnapshot();
    const session = loadSession();
    if (!sessionKey || !session?.storeId || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshError(undefined);
    try {
      const next = await refreshGrants(session, sessionKey);
      updateApi("grants", () => next);
    } catch (error) {
      if (sessionSnapshot() === sessionKey) setRefreshError(error instanceof ApiError ? error.message : refreshErrorMessage);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }

  let data: GrantsViewData | undefined;
  if (context && (!apiActive || response)) {
    const live = response && readGrants(response, api?.bundle.me?.user.provider === "demo");
    const catalog = live?.catalog ?? context.GRANTS;
    const categories = ["all", ...new Set(catalog.map((grant) => grant.cat))];
    const filters = categories.includes(context.G.cat) ? context.G : { ...context.G, cat: "all" };
    const { counts, nextDeadline } = selectGrantOverview(catalog, filters, iso(realToday()));
    const present = (grant: Grant): GrantViewItem => ({
      grant,
      label: context.RES[grant.res][0],
      tone: context.RES[grant.res][1],
      deadline: grant.deadline ? context.dday(grant.deadline) : "일정 미정",
    });
    data = {
      filters,
      overview: { counts, nextDeadline: nextDeadline && present(nextDeadline) },
      grants: selectGrants(catalog, filters).map(present),
      categories,
      excludedCount: live?.excludedCount ?? context.GRANT_EXCLUDED,
      sourceLabel: live?.sourceLabel,
      status: live?.status,
    };
  }
  return {
    data,
    loading: !data && !apiError,
    error: !data ? apiError : null,
    onRetry: () => void refreshApi(["grants"]),
    onRefresh: apiActive ? () => void refresh() : undefined,
    refreshing,
    refreshError: refreshing ? undefined : refreshError ?? (response?.error ? refreshErrorMessage : undefined),
    onEvent,
    apiActive,
  };
}
