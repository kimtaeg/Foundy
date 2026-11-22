import { ReactNode } from "react";

export interface AppShellProps {
  navigation: ReactNode;
  children: ReactNode;
  viewport?: boolean;
}
export function AppShell({ navigation, children, viewport = false }: AppShellProps) {
  return (
    <div
      className={viewport
        ? "flex h-dvh flex-col overflow-hidden bg-white text-neutral-900"
        : "min-h-dvh bg-white text-neutral-900"}
    >
      <a
        href="#mainContent"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-white focus:p-3"
      >
        본문으로 바로가기
      </a>
      <div className="sticky top-0 z-50 shrink-0">{navigation}</div>
      <main
        id="mainContent"
        tabIndex={-1}
        className={viewport
          ? "relative min-h-0 w-full flex-1"
          : "mx-auto w-full max-w-[1180px] px-4 pt-8 pb-24 sm:px-7 lg:px-10"}
      >
        {children}
      </main>
    </div>
  );
}
