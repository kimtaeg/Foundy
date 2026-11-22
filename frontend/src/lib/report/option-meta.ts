import { type ReportOption } from "@/types/report";

export function optionMeta({ time, cost }: ReportOption): string {
  const duration = time?.[0]?.trim();
  const expense = cost?.[0]?.trim();
  if (!duration && !expense) return "";
  const knownDuration = duration && duration !== "확인 필요";
  const knownExpense = expense && expense !== "확인 필요";
  if (!knownDuration && !knownExpense) return "기간·비용 확인 필요";
  return [knownDuration ? duration : "기간 확인 필요", knownExpense ? expense : "비용 확인 필요"].join(" · ");
}
