"use client";
import { ApplicationNavigation } from "@/components/layout/ApplicationNavigation";
import { useFoundy } from "@/hooks/useFoundy";

export function ConnectedApplicationNavigation() {
  const { snapshot, navigate, logout, openNotification } = useFoundy();
  return (
    <ApplicationNavigation
      data={snapshot ? {
        currentPage: snapshot.currentPage,
        storeName: snapshot.storeName,
        notifications: snapshot.notifications,
        onboarded: snapshot.onboarded,
      } : undefined}
      onNavigate={navigate}
      onOpenNotification={(notification) => openNotification(notification.id)}
      onLogout={logout}
    />
  );
}
