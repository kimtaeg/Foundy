"use client";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SignupCard } from "@/components/login/SignupCard";
import { Element } from "@/components/view/Element";
import { FeatureView } from "@/components/view/FeatureView";
import type { ViewEventHandler } from "@/types/events";
import { Suspense } from "react";

export interface SignupViewProps { onEvent?: ViewEventHandler }

export function SignupView({ onEvent }: SignupViewProps = {}) {
  return (
    <FeatureView page="signup" onEvent={onEvent}>
      <Element id="authScreen" className="nx-auth">
        <Suspense fallback={<PageSkeleton page="login" />}>
          <SignupCard />
        </Suspense>
      </Element>
    </FeatureView>
  );
}
