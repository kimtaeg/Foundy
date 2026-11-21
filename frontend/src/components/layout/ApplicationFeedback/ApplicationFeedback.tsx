"use client";
import { Modal } from "@/components/feedback/Modal";
import { Toast } from "@/components/feedback/Toast";
import { ApplicationDialog } from "@/components/layout/ApplicationDialog";
import { EventBoundary } from "@/components/view/EventBoundary";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { DataViewProps } from "@/types/data-state";
import type { ApplicationDialog as DialogData } from "@/types/dialog";
import { Suspense } from "react";

export interface ApplicationFeedbackData {
  modal: DialogData | null;
  toast: string;
}
export interface ApplicationFeedbackProps extends DataViewProps<ApplicationFeedbackData> {
  onCloseModal: () => void;
}

export function ApplicationFeedback({ onCloseModal, onEvent, ...state }: ApplicationFeedbackProps) {
  return (
    <DataBoundary
      {...state}
      fallback={<SectionSkeleton variant="card" label="안내를 불러오는 중" className="fixed bottom-24 right-4 z-[60] w-72" />}
    >
      {(data) => (
        <>
          {data.modal && (
            <Modal title={data.modal.title} onClose={onCloseModal}>
              <EventBoundary onEvent={onEvent}>
                <Suspense fallback={<SectionSkeleton variant="form" label="상세 안내를 불러오는 중" />}>
                  <ApplicationDialog content={data.modal.content} />
                </Suspense>
              </EventBoundary>
            </Modal>
          )}
          {data.toast && <Toast message={data.toast} />}
        </>
      )}
    </DataBoundary>
  );
}
