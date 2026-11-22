"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import type { ChatViewData } from "@/types/chat";

export function useChat(): ChatViewData | null {
  const { context } = useFeatureData("chat");
  if (!context) return null;
  const cards = context.buildCards();
  const undecided = context.S.location === "undecided";
  const focus =
    !undecided && context.CH.focus
      ? cards.find((card) => card.id === context.CH.focus)
      : undefined;
  return {
    cards,
    undecided,
    focus: focus ? {
      title: focus.title,
      verdict: context.ev(focus),
      verdictLabel: context.VL[context.ev(focus)],
    } : undefined,
    storeName: context.eff().name || "내 가게",
    messages: context.CH.msgs,
    busy: context.CH.busy,
    request: context.CH.request,
    draft: context.CH.draft,
    memo: context.CH.memo,
    contacts: context.CONTACT,
    actionLabels: context.ACTLBL,
    callGuides: Object.fromEntries(cards.map((card) => [card.id, context.callSteps(card)])),
  };
}
