import { NavDropdownIcon } from "@/components/navigation/NavDropdownIcon";
import type { NavigationDestination } from "@/types/navigation";

export interface NavDropdownItemProps {
  destination: NavigationDestination;
  active: boolean;
  onNavigate: (page: string) => void;
}

export function NavDropdownItem({ destination, active, onNavigate }: NavDropdownItemProps) {
  return (
    <button type="button" data-page={destination.id} aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(destination.id)}
      className={`flex min-h-11 w-full cursor-pointer items-center gap-2 border-0 p-4 text-left transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foundy-primary [-webkit-tap-highlight-color:transparent] ${active ? "bg-foundy-primary/5 text-foundy-primary-ink" : "bg-transparent text-neutral-900 hover:bg-neutral-50"}`}>
      <NavDropdownIcon destinationId={destination.id} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-6">{destination.label}</span>
        {destination.description && <span className="mt-0.5 block text-[13px] leading-5 text-neutral-600">{destination.description}</span>}
      </span>
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" className={`size-4 shrink-0 ${active ? "text-foundy-primary" : "text-neutral-400"}`}>
        <path d={active ? "m3 8 3 3 7-7" : "m6 4 4 4-4 4"} />
      </svg>
    </button>
  );
}
