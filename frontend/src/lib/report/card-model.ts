import type { ReportCardData, ReportCardModel, ReportContext } from "@/types/report";

export function isFollowUpPending(context: Pick<ReportContext, "RS" | "curAction">, card: ReportCardData) {
  const state = context.RS[card.id];
  return Boolean(state?.chosen && state.action !== "done" && context.curAction(card));
}

type CardContext = Pick<ReportContext, "RS" | "ev" | "curAction" | "CONTACT" | "nextSteps" | "cardShort">;

export function getReportCardModel(context: CardContext, card: ReportCardData, open = false): ReportCardModel {
  const followUpPending = isFollowUpPending(context, card);
  return {
    card,
    state: context.RS[card.id] || {},
    verdict: context.ev(card),
    action: context.curAction(card),
    contact: card.contact ? context.CONTACT[card.contact] : undefined,
    nextSteps: context.nextSteps(card.id),
    shortTitle: context.cardShort(card),
    open: open || followUpPending,
    followUpPending,
  };
}
