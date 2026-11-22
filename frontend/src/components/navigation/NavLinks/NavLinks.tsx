import { NavItem } from "@/components/navigation/NavItem";
import { NavDropdown } from "@/components/navigation/NavDropdown";
import { destinations as defaultDestinations, preparationNavigationLabel } from "@/data/navigation";
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
  const preparation = destinations.filter((destination) => destination.group === "preparation");
  return (
    <nav
      aria-label="주 메뉴"
      id="nav"
      className={`flex min-w-0 flex-wrap items-center gap-1 py-1 ${className}`}
    >
      {destinations.map((destination) => destination.group === "preparation" ? (
        destination === preparation[0] && <NavDropdown key="preparation" label={preparationNavigationLabel}
          destinations={preparation} currentPage={currentPage} onNavigate={onNavigate} />
      ) : (
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
