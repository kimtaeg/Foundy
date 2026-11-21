"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import {
  type ReportCardData,
  type ReportAction,
  type ReportCardModel,
  type ReportContext,
  type ReportState,
  type ReportViewData,
  type Verdict,
} from "@/types/report";

const severity: Record<Verdict, number> = {
  high: 0,
  low: 1,
  unknown: 2,
  ok: 3,
};

/** 선택지를 정했고 후속 행동이 있지만 아직 마치지 않았는지 */
function isFollowUpPending(context: ReportContext, card: ReportCardData) {
  const state = context.RS[card.id];
  return Boolean(
    state?.chosen && state.action !== "done" && context.curAction(card),
  );
}

/** 후속 행동을 마치기 전에는 원래 심각도 자리에 두어 카드가 튀지 않게 한다. */
function rank(context: ReportContext, card: ReportCardData) {
  return severity[
    isFollowUpPending(context, card) ? card.base : context.ev(card)
  ];
}

function statusLabel(
  card: ReportCardData,
  state: ReportState,
  action: ReportAction | null,
  followUpPending: boolean,
) {
  if (card.options.length && !state.chosen) return "결정하기";
  if (!action) return "";
  if (state.action === "done") return "완료 ✓";
  return followUpPending || !card.options.length ? "할 일 남음" : "";
}

function cardModel(
  context: ReportContext,
  card: ReportCardData,
  open: boolean,
): ReportCardModel {
  const state = context.RS[card.id] || {};
  const action = context.curAction(card);
  const followUpPending = isFollowUpPending(context, card);
  return {
    card,
    state,
    verdict: context.ev(card),
    action,
    contact: card.contact ? context.CONTACT[card.contact] : undefined,
    nextSteps: context.nextSteps(card.id),
    shortTitle: context.cardShort(card),
    open: open || followUpPending,
    followUpPending,
    statusLabel: statusLabel(card, state, action, followUpPending),
  };
}

export function useReport(): ReportViewData | null {
  const { context } = useFeatureData("report");
  if (!context) return null;
  const cards = context.buildCards();
  const counts: Record<Verdict, number> = {
    high: 0,
    low: 0,
    unknown: 0,
    ok: 0,
  };
  cards.forEach((card) => counts[context.ev(card)]++);
  const shown = cards
    .filter(
      (card) =>
        context.reportFilter === "all" || card.stage === context.reportFilter,
    )
    .sort((a, b) => rank(context, a) - rank(context, b));
  const needsDecision = (card: ReportCardData) =>
    card.options.length > 0 &&
    !context.RS[card.id]?.chosen &&
    context.ev(card) !== "ok";
  const openId = shown.find(needsDecision)?.id;
  return {
    locked: context.S.location === "undecided",
    filter: context.reportFilter,
    counts,
    firstByVerdict: Object.fromEntries(
      [...shown].reverse().map((card) => [context.ev(card), card.id]),
    ) as Partial<Record<Verdict, string>>,
    cards: shown.map((card) => cardModel(context, card, card.id === openId)),
  };
}
