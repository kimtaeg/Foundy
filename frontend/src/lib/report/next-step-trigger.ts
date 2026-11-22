import type { NextStep } from "@/types/report";

export function nextStepTrigger(step: NextStep) {
  const [page, target] = step.go;
  if (page === "report" && target && (step.k === "do" || step.k === "decide")) {
    return {
      "data-nx": step.k === "decide" ? "options" : "optionresult",
      "data-id": target,
      "aria-haspopup": "dialog" as const,
    };
  }
  return { "data-nx": "cnav", "data-p": page, "data-focus": target };
}
