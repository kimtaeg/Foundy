"use client";
import { LoginLayout } from "@/components/login/LoginLayout";
import { LoginSkeleton } from "@/components/login/LoginSkeleton";
import { FeatureView } from "@/components/view/FeatureView";
import type { SignInHandler, SignUpHandler } from "@/types/auth";
import type { ViewEventHandler } from "@/types/events";
import { Suspense } from "react";

export interface LoginViewProps {
  onEvent?: ViewEventHandler;
  onSignIn?: SignInHandler;
  onSignUp?: SignUpHandler;
}

export function LoginView({ onEvent, onSignIn, onSignUp }: LoginViewProps = {}) {
  return (
    <FeatureView page="login" onEvent={onEvent}>
      <main id="authScreen" className="min-h-dvh w-full bg-white">
        <Suspense fallback={<LoginSkeleton />}>
          <LoginLayout onSignIn={onSignIn} onSignUp={onSignUp} />
        </Suspense>
      </main>
    </FeatureView>
  );
}
