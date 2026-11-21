"use client";
import { AccountActions } from "@/components/navigation/AccountActions";
import { Logo } from "@/components/navigation/Logo";
import { NavLinks } from "@/components/navigation/NavLinks";
import { type NavbarProps } from "@/types/navigation";

export type { NavbarProps } from "@/types/navigation";

/** Navigation owns layout only; destination and account actions come from its caller. */
export function Navbar({
  currentPage,
  storeName,
  notifications,
  onNavigate,
  onOpenNotification,
  onLogout,
  onboarded = true,
  destinations,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 border-0 border-b border-solid border-neutral-200 bg-neutral-50">
      <div className="mx-auto grid max-w-[1480px] grid-cols-[auto_1fr] items-center gap-x-3 px-4 py-4 sm:px-7 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-x-7 xl:px-9 xl:py-4">
        <Logo onHome={() => onNavigate("dashboard")} />
        {onboarded && (
          <NavLinks
            currentPage={currentPage}
            onNavigate={onNavigate}
            destinations={destinations}
            className="col-span-2 col-start-1 row-start-2 -mb-2 mt-3 border-0 border-t border-solid border-neutral-100 pt-3 xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:m-0 xl:justify-center xl:border-0 xl:p-0"
          />
        )}
        <div className="col-start-2 row-start-1 flex justify-end xl:col-start-3">
          <AccountActions
            storeName={storeName}
            notifications={notifications}
            onOpenNotification={onOpenNotification}
            onOpenStore={() => onNavigate("mypage")}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  );
}
