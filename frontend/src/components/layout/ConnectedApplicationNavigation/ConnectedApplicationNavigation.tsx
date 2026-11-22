"use client";
import { ApplicationNavigation } from "@/components/layout/ApplicationNavigation";
import { useFoundy } from "@/hooks/useFoundy";

export function ConnectedApplicationNavigation() {
  const {
    snapshot, navigate, logout, openNotification,
    notificationError, notificationsLoading, retryNotifications,
  } = useFoundy();
  return (
    <ApplicationNavigation
      data={snapshot ? {
        currentPage: snapshot.currentPage,
        storeName: snapshot.storeName,
        notifications: snapshot.notifications,
        notificationFetch: { loading: notificationsLoading, error: notificationError, retry: retryNotifications },
        onboarded: snapshot.onboarded,
      } : undefined}
      onNavigate={navigate}
      onOpenNotification={(notification) => openNotification(notification.id)}
      onLogout={logout}
    />
  );
}
