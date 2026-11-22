"use client";

import { useEffect, useRef } from "react";
import { Toaster, toast } from "sonner";

export type ToastProps = { message: string; notificationId?: number };

/** Bridges application feedback to the single Sonner notification surface. */
export function Toast({ message, notificationId }: ToastProps) {
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (!message) {
      previous.current = null;
      return;
    }
    const key = `${notificationId ?? ""}:${message}`;
    if (previous.current === key) return;
    previous.current = key;
    toast(message, {
      id: "foundy-feedback",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9v.1" />
        </svg>
      ),
    });
  }, [message, notificationId]);

  return (
    <Toaster
      position="bottom-center"
      theme="light"
      duration={4000}
      closeButton
      visibleToasts={1}
      offset={28}
      mobileOffset={{ bottom: "max(20px, env(safe-area-inset-bottom))", left: 16, right: 16 }}
      containerAriaLabel="알림"
      toastOptions={{
        closeButtonAriaLabel: "알림 닫기",
        style: {
          background: "#ffffff",
          color: "#262626",
          border: "1px solid #dbe9e7",
          borderRadius: 16,
          padding: "16px 20px",
          gap: 12,
          fontFamily: "var(--font-body)",
          boxShadow: "0 8px 32px rgb(15 60 57 / 12%), 0 2px 6px rgb(15 60 57 / 4%)",
        },
        classNames: {
          title: "text-sm! font-medium! leading-relaxed! [overflow-wrap:anywhere]",
          icon: "text-foundy-primary!",
          closeButton: "border-neutral-200! bg-white! text-neutral-500! hover:bg-neutral-100!",
        },
      }}
    />
  );
}
