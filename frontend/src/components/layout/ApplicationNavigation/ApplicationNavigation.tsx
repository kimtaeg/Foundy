"use client";
import { Navbar } from "@/components/navigation/Navbar";
import { DataBoundary } from "@/components/loading/DataBoundary";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import type { DataState } from "@/types/data-state";
import type { NavbarData, NavbarProps } from "@/types/navigation";

export interface ApplicationNavigationProps
  extends DataState<NavbarData>,
    Pick<NavbarProps, "onNavigate" | "onOpenNotification" | "onLogout"> {}

export function ApplicationNavigation({ onNavigate, onOpenNotification, onLogout, ...state }: ApplicationNavigationProps) {
  return (
    <DataBoundary
      {...state}
      fallback={<SectionSkeleton variant="navigation" label="메뉴를 불러오는 중" />}
    >
      {(data) => (
        <Navbar
          {...data}
          onNavigate={onNavigate}
          onOpenNotification={onOpenNotification}
          onLogout={onLogout}
        />
      )}
    </DataBoundary>
  );
}
