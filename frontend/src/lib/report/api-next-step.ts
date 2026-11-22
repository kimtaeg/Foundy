import type { ApiNextStep } from "@/lib/api/types";
import type { NextStep } from "@/types/report";

const destinationLabels: Record<string, string> = {
  report: "카드 열기",
  checklist: "체크리스트 열기",
  docs: "서류함 열기",
};

export function toReportNextStep(step: ApiNextStep): NextStep {
  return {
    k: step.kind,
    t: step.title,
    s: step.sub,
    go: [step.go.page, step.go.item_id ?? ""],
    cta: destinationLabels[step.go.page] ?? "열기",
  };
}
