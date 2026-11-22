import type { ReportCardData, Verdict } from "@/types/report";

/** The evaluator is injected so counts match the report page's current state. */
export function countDashboardReports(
  cards: readonly ReportCardData[],
  evaluate: (card: ReportCardData) => Verdict,
): Record<Verdict, number> {
  const counts: Record<Verdict, number> = { high: 0, low: 0, unknown: 0, ok: 0 };
  for (const card of cards) counts[evaluate(card)] += 1;
  return counts;
}
