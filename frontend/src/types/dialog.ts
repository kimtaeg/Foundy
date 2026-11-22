import { type Grant } from "@/types/grants";
import type { EvidenceItemData as EvidenceItem, ReportCardData, ReportCardModel } from "./report";

/** Serializable dialog data; state logic never constructs view markup. */
export type DialogContent =
  | { kind: "evidence"; items: EvidenceItem[]; date?: string }
  | { kind: "option-choices"; card: ReportCardData }
  | { kind: "option-result"; model: ReportCardModel }
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
  | { kind: "store-reset" };

export interface ApplicationDialog {
  title: string;
  content: DialogContent;
}
