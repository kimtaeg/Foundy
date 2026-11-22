import { dialogActionRow, dialogPrimaryAction, dialogSecondaryAction } from "@/components/feedback/Modal/dialog-styles";
import type { DialogContent } from "@/types/dialog";

type ReportActionDialog = Extract<DialogContent, { kind: "option-confirm" | "option-result" }>;

const focusStyle = "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foundy-primary";

export interface ReportDialogActionsProps {
  content: ReportActionDialog;
}

export function ReportDialogActions({ content }: ReportDialogActionsProps) {
  if (content.kind === "option-confirm") {
    return (
      <div data-dialog-actions="" className={dialogActionRow}>
        <button type="button" data-nx="options" data-id={content.cardId} className={dialogSecondaryAction}>다시 선택</button>
        <button type="button" data-nx="confirm" data-id={content.cardId} data-o={content.optionId} className={`${dialogPrimaryAction} ${focusStyle}`}>선택지 적용</button>
      </div>
    );
  }

  const { card, state, action } = content.model;
  return (
    <div data-dialog-actions="" className={dialogActionRow}>
      <button type="button" data-dialog-dismiss="" className={dialogSecondaryAction}>닫기</button>
      {action && (
        state.action === "done" ? (
          <button type="button" data-nx="actreset" data-id={card.id} className={dialogSecondaryAction}>완료 취소</button>
        ) : (
          <button type="button" data-nx="actdone" data-id={card.id} className={`${dialogPrimaryAction} gap-2 ${focusStyle}`}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4 10-10" /></svg>
            작업 완료
          </button>
        )
      )}
    </div>
  );
}
