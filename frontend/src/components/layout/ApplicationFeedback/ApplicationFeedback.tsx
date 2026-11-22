"use client";
import { Modal } from "@/components/feedback/Modal";
import { Toast } from "@/components/feedback/Toast";
import { ApplicationDialog } from "@/components/layout/ApplicationDialog";
import { ReportDialogActions } from "@/components/report/ReportDialogActions";
import { EventBoundary } from "@/components/view/EventBoundary";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { DataViewProps } from "@/types/data-state";
import type { ApplicationDialog as DialogData, DialogContent } from "@/types/dialog";
import { Suspense } from "react";

export interface ApplicationFeedbackData {
  modal: DialogData | null;
  toast: string;
  toastId?: number;
}
export interface ApplicationFeedbackProps extends DataViewProps<ApplicationFeedbackData> {
  onCloseModal: () => void;
}

function reportDialogCardId(content?: DialogContent) {
  if (content?.kind === "option-choices") return content.card.id;
  if (content?.kind === "option-confirm") return content.cardId;
  if (content?.kind === "option-result") return content.model.card.id;
}

function reportFocusTarget(cardId: string) {
  const item = document.getElementById(`result-${cardId}`);
  if (!(item instanceof HTMLDetailsElement)) return null;
  const picker = document.getElementById(`option-picker-${cardId}`);
  if (picker) {
    // Undo can collapse the card as its pending follow-up disappears.
    item.open = true;
    return picker;
  }
  const opener = document.getElementById(`option-result-${cardId}`) ?? document.getElementById(`option-history-${cardId}`);
  return (item.open && opener) || item.querySelector("summary");
}

export function ApplicationFeedback({ onCloseModal, onEvent, ...state }: ApplicationFeedbackProps) {
  return (
    <DataBoundary
      {...state}
      fallback={<SectionSkeleton variant="card" label="안내를 불러오는 중" className="fixed bottom-24 right-4 z-[60] w-72" />}
    >
      {(data) => {
        const content = data.modal?.content;
        const cardId = reportDialogCardId(content);
        const kind = content?.kind;
        const actions = content?.kind === "option-confirm" || content?.kind === "option-result" ? (
          <EventBoundary onEvent={onEvent}>
            <ReportDialogActions content={content} />
          </EventBoundary>
        ) : undefined;
        return (
          <>
            {data.modal && (
              <Modal
                key={cardId ? `${kind}-${cardId}` : "dialog"}
                title={data.modal.title}
                onClose={onCloseModal}
                variant={kind}
                actions={actions}
                getReturnFocusTarget={cardId ? () => reportFocusTarget(cardId) : undefined}
              >
                <EventBoundary onEvent={onEvent}>
                  <Suspense fallback={<SectionSkeleton variant="form" label="상세 안내를 불러오는 중" />}>
                    <ApplicationDialog content={data.modal.content} />
                  </Suspense>
                </EventBoundary>
              </Modal>
            )}
            <Toast message={data.toast} notificationId={data.toastId} />
          </>
        );
      }}
    </DataBoundary>
  );
}
