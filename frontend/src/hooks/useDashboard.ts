"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { buildDashboardPreparation, countDashboardReports } from "@/lib/dashboard";
import { iso } from "@/lib/date";
import { type DashboardAction, type DashboardViewData } from "@/types/dashboard";

export function useDashboard(): DashboardViewData | null {
  const { context, api, apiActive } = useFeatureData("dashboard");
  if (apiActive) return api?.dashboard ?? null;
  if (!context) return null;
  const cards = context.buildCards();
  const tasks = context.allTasks();
  const preparation = buildDashboardPreparation(tasks);
  const today = context.realToday();
  const undecided = context.S.location === "undecided";
  const actions: DashboardAction[] = cards.flatMap((card) => {
    const action = context.curAction(card);
    const state = context.RS[card.id] || {};
    if (
      !action ||
      (card.base === "ok" && !state.chosen) ||
      (card.options.length && !state.chosen) ||
      state.action === "done"
    )
      return [];
    return [{ id: card.id, action }];
  });
  return {
    store: context.S,
    name: context.eff().name || "내 가게",
    undecided,
    days: context.diffDays(context.D(context.S.opening), today),
    decisions: context.pendingDecisions(),
    ...preparation,
    actions,
    reportCounts: undecided ? undefined : countDashboardReports(cards, (card) => context.ev(card)),
    asOf: iso(today),
  };
}
