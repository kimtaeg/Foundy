"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { getReportCardModel, isFollowUpPending } from "@/lib/report/card-model";
import {
  type ReportCardData,
  type ReportContext,
  type ReportViewData,
  type Verdict,
} from "@/types/report";

const severity: Record<Verdict, number> = {
  high: 0,
  low: 1,
  unknown: 2,
  ok: 3,
};

/** 후속 행동을 마치기 전에는 원래 심각도 자리에 두어 카드가 튀지 않게 한다. */
function rank(context: ReportContext, card: ReportCardData) {
  return severity[
    isFollowUpPending(context, card) ? card.base : context.ev(card)
  ];
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
    cards: shown.map((card) => getReportCardModel(context, card, card.id === openId)),
  };
}
