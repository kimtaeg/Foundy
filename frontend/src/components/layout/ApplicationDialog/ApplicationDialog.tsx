import { OpeningDateDialog } from "@/components/checklist/OpeningDateDialog";
import { GrantDetails } from "@/components/grants/GrantDetails";
import { StoreResetDialog } from "@/components/mypage/StoreResetDialog";
import { EvidenceDialog } from "@/components/report/EvidenceDialog";
import { OptionConfirmDialog } from "@/components/report/OptionConfirmDialog";
import { ReportChoiceDialog } from "@/components/report/ReportChoiceDialog";
import { ReportResultDialog } from "@/components/report/ReportResultDialog";
import { LocationPickDialog } from "@/components/sites/LocationPickDialog";
import { type DialogContent } from "@/types/dialog";

/** Resolves dialog data into the corresponding view. */
export interface ApplicationDialogProps { content: DialogContent }

export function ApplicationDialog({ content }: ApplicationDialogProps) {
  switch (content.kind) {
    case "evidence":
      return <EvidenceDialog items={content.items} date={content.date} />;
    case "option-choices":
      return <ReportChoiceDialog card={content.card} />;
    case "option-result":
      return <ReportResultDialog model={content.model} />;
    case "grant":
      return (
        <GrantDetails
          grant={content.grant}
          deadline={content.deadline}
          result={content.result}
        />
      );
    case "option-confirm":
      return (
        <OptionConfirmDialog
          cardId={content.cardId}
          optionId={content.optionId}
          label={content.label}
          summary={content.summary}
          changes={content.changes}
          recommended={content.recommended}
          reason={content.reason}
          meta={content.meta}
        />
      );
    case "opening-date":
      return <OpeningDateDialog opening={content.opening} />;
    case "location-pick":
      return <LocationPickDialog areaId={content.areaId} />;
    case "store-reset":
      return <StoreResetDialog />;
  }
}
