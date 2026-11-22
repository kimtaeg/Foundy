"use client";
import { ConnectedChatWidget } from "@/components/chat/ConnectedChatWidget";
import { ConnectedApplicationFeedback } from "@/components/layout/ConnectedApplicationFeedback";
import { ApplicationLoading } from "@/components/layout/ApplicationLoading";
import { ConnectedApplicationNavigation } from "@/components/layout/ConnectedApplicationNavigation";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { DataError } from "@/components/loading/DataError";
import { AppShell } from "@/components/layout/AppShell";
import { LoginView } from "@/components/login/LoginView";
import { useFoundy } from "@/hooks/useFoundy";
import { ReactNode } from "react";

export interface FoundyApplicationProps { children: ReactNode }

export function FoundyApplication({ children }: FoundyApplicationProps) {
  const { engine, snapshot, pendingPage, onEvent, signIn, signUp, startupError, retryStartup, apiError, refreshApi } = useFoundy();
  if (startupError) return <DataError message={startupError} onRetry={retryStartup} />;
  if (!engine || !snapshot) return <ApplicationLoading />;
  let content = children;
  if (pendingPage) content = <PageSkeleton page={pendingPage} />;
  else if (apiError && snapshot.onboarded && snapshot.currentPage !== "grants") {
    content = <DataError message={apiError} onRetry={() => void refreshApi()} />;
  }
  return (
    <>
      {snapshot.uid ? (
        <>
          <AppShell
            navigation={<ConnectedApplicationNavigation />}
            viewport={snapshot.currentPage === "sites"}
          >
            {content}
          </AppShell>
          <ConnectedChatWidget />
        </>
      ) : (
        <LoginView onEvent={onEvent} onSignIn={signIn} onSignUp={signUp} />
      )}
      <ConnectedApplicationFeedback />
    </>
  );
}
