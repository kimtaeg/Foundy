"use client";
import { ConnectedChatWidget } from "@/components/chat/ConnectedChatWidget";
import { ConnectedApplicationFeedback } from "@/components/layout/ConnectedApplicationFeedback";
import { ApplicationLoading } from "@/components/layout/ApplicationLoading";
import { ConnectedApplicationNavigation } from "@/components/layout/ConnectedApplicationNavigation";
import { AppShell } from "@/components/layout/AppShell";
import { LoginView } from "@/components/login/LoginView";
import { SignupView } from "@/components/login/SignupView";
import { useFoundy } from "@/hooks/useFoundy";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export interface FoundyApplicationProps { children: ReactNode }

export function FoundyApplication({ children }: FoundyApplicationProps) {
  const { engine, snapshot, onEvent } = useFoundy();
  const pathname = usePathname();
  if (!engine || !snapshot) return <ApplicationLoading />;
  return (
    <>
      {snapshot.uid ? (
        <>
          <AppShell
            navigation={<ConnectedApplicationNavigation />}
            viewport={snapshot.currentPage === "sites"}
          >
            {children}
          </AppShell>
          <ConnectedChatWidget />
        </>
      ) : (
        pathname === "/signup" ? (
          <SignupView onEvent={onEvent} />
        ) : (
          <LoginView onEvent={onEvent} />
        )
      )}
      <ConnectedApplicationFeedback />
    </>
  );
}
