"use client";
import { LoginCard } from "@/components/login/LoginCard";
import { Element } from "@/components/view/Element";
import { FeatureView } from "@/components/view/FeatureView";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import type { ViewEventHandler } from "@/types/events";
import { Suspense } from "react";

export interface LoginViewProps { onEvent?: ViewEventHandler }

export function LoginView({ onEvent }: LoginViewProps = {}) {
  return (
    <FeatureView page="login" onEvent={onEvent}>
      <Element id="authScreen" className="nx-auth">
        <Suspense fallback={<PageSkeleton page="login" />}>
          <LoginCard />
        </Suspense>
      </Element>
    </FeatureView>
  );
}
