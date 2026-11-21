import { NavItem } from "@/components/navigation/NavItem";
import { destinations as defaultDestinations } from "@/data/navigation";
import type { NavigationDestination } from "@/types/navigation";

export interface NavLinksProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  className?: string;
  destinations?: NavigationDestination[];
}
export function NavLinks({
  currentPage,
  onNavigate,
  className = "",
  destinations = defaultDestinations,
}: NavLinksProps) {
  return (
    <nav
      aria-label="주 메뉴"
      id="nav"
      className={`flex min-w-0 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {destinations.map((destination) => (
        <NavItem
          key={destination.id}
          destination={destination}
          active={currentPage === destination.id}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
