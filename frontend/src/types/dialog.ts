import { type Grant } from "@/types/grants";
import type { EvidenceItemData as EvidenceItem } from "./report";

/** Serializable dialog data; state logic never constructs view markup. */
export type DialogContent =
  | { kind: "evidence"; items: EvidenceItem[]; date: string }
  | {
      kind: "grant";
      grant: Grant;
      deadline: string;
      result: { label: string; tone: string };
    }
  | {
      kind: "option-confirm";
      cardId: string;
      optionId: string;
      label: string;
      summary: string;
      changes: string[];
      recommended: boolean;
      reason?: string;
      meta: string;
    }
  | { kind: "opening-date"; opening: string }
  | { kind: "location-pick"; areaId: string }
  | { kind: "social-sign-in"; provider: string; providerLabel: string }
  | { kind: "store-reset" }
  | {
      kind: "analysis-progress";
      steps: string[];
      completed: number;
      changes: string[];
    };

export interface ApplicationDialog {
  title: string;
  content: DialogContent;
}
