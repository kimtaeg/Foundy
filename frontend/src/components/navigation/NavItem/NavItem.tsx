import { type NavigationDestination } from "@/types/navigation";

export interface NavItemProps {
  destination: NavigationDestination;
  active: boolean;
  onNavigate: (page: string) => void;
}
export function NavItem({ destination, active, onNavigate }: NavItemProps) {
  return (
    <button
      type="button"
      data-page={destination.id}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(destination.id)}
      className={`relative shrink-0 cursor-pointer rounded-[10px] border-0 px-3 py-2.5 text-sm leading-5 font-semibold whitespace-nowrap transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-foundy-primary ${active ? "bg-neutral-100 text-foundy-primary-ink" : "bg-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800"}`}
    >
      {destination.label}
    </button>
  );
}
