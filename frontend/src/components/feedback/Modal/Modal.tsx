"use client";
import { useEffect, useRef, type ReactNode } from "react";

export interface ModalProps {
  title: string;
  children: ReactNode;
  onClose(): void;
}
export function Modal({ title, children, onClose }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>("input,button,textarea,select")
      ?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        ) || [],
      );
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, []);
  return (
    <div
      id="modal"
      className="show fixed inset-0 z-[90] flex items-center justify-center bg-neutral-900/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalTitle"
        className="max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
      >
        <h2 id="modalTitle" className="mb-3 text-xl font-bold tracking-tight">
          {title}
        </h2>
        <div id="modalBody">{children}</div>
        <div className="mt-5 flex justify-end">
          <button
            id="closeModal"
            type="button"
            onClick={onClose}
            className="rounded-xl border-0 bg-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
