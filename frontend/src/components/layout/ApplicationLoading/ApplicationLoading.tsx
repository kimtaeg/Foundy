"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { NavbarSkeleton } from "@/components/navigation/NavbarSkeleton";
import { isFeaturePage } from "@/lib/routes";

export interface ApplicationLoadingProps {
  withinShell?: boolean;
}

export function ApplicationLoading({ withinShell = false }: ApplicationLoadingProps) {
  const segment = usePathname().split("/")[1];
  const page = segment === "login" || isFeaturePage(segment) ? segment : "dashboard";
  const content = <PageSkeleton page={page} />;
  if (withinShell || page === "login") return content;
  return <AppShell navigation={<NavbarSkeleton />} viewport={page === "sites"}>{content}</AppShell>;
}
