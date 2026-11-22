"use client";

import { LoginArtwork } from "@/components/login/LoginArtwork";
import { LoginHeading } from "@/components/login/LoginHeading";
import { LoginForm } from "@/components/login/LoginForm";
import { LoginBrand } from "@/components/login/LoginBrand";
import type { SignInHandler, SignUpHandler } from "@/types/auth";
import { useState } from "react";

export interface LoginLayoutProps {
  onSignIn?: SignInHandler;
  onSignUp?: SignUpHandler;
}

export function LoginLayout({ onSignIn, onSignUp }: LoginLayoutProps) {
  const [signingUp, setSigningUp] = useState(false);

  function switchForm() {
    setSigningUp((current) => !current);
  }
  return (
    <div
      data-testid="login-layout"
      className="grid min-h-dvh w-full bg-white text-neutral-900 md:grid-cols-2"
    >
      <LoginArtwork />
      <div className="flex min-h-dvh min-w-0 items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="flex w-full max-w-[400px] flex-col">
          <div className="flex w-full flex-col gap-4">
            <LoginBrand />
            <div className="flex flex-col gap-8">
              <LoginHeading signingUp={signingUp} />
              {signingUp ? (
                <LoginForm key="signup" mode="signup" onSignUp={onSignUp} onSwitch={switchForm} />
              ) : (
                <LoginForm key="login" onSignIn={onSignIn} onSwitch={switchForm} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
