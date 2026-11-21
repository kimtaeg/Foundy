"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { type DashboardAction, type DashboardViewData } from "@/types/dashboard";

export function useDashboard(): DashboardViewData | null {
  const { context } = useFeatureData("dashboard");
  if (!context) return null;
  const actions: DashboardAction[] = context.buildCards().flatMap((card) => {
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
    undecided: context.S.location === "undecided",
    days: context.diffDays(context.D(context.S.opening), context.realToday()),
    decisions: context.pendingDecisions(),
    taskCount: context.taskCount(),
    unread: context
      .alertsFor(context.SIM)
      .filter((alert) => !context.AR[alert.id]).length,
    actions,
    tasks: context
      .allTasks()
      .filter((task) => !task.done)
      .slice(0, 4),
  };
}
