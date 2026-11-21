"use client";
import { ConnectedChatWidget } from "@/components/chat/ConnectedChatWidget";
import { ConnectedApplicationFeedback } from "@/components/layout/ConnectedApplicationFeedback";
import { ApplicationLoading } from "@/components/layout/ApplicationLoading";
import { ConnectedApplicationNavigation } from "@/components/layout/ConnectedApplicationNavigation";
import { AppShell } from "@/components/layout/AppShell";
import { LoginView } from "@/components/login/LoginView";
import { useFoundy } from "@/hooks/useFoundy";
import { ReactNode } from "react";

export interface FoundyApplicationProps { children: ReactNode }

export function FoundyApplication({ children }: FoundyApplicationProps) {
  const { engine, snapshot, onEvent } = useFoundy();
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
        <LoginView onEvent={onEvent} />
      )}
      <ConnectedApplicationFeedback />
    </>
  );
}
