import { type NavigationDestination } from "@/types/navigation";
import { navigationItemClasses } from "@/lib/styles/navigation";

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
      className={navigationItemClasses(active)}
    >
      {destination.label}
    </button>
  );
}
